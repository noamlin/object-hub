"use strict"

const debug = require('debug');
const handlersLog = debug('handlers');
const { cloneDeep } = require('lodash');
const ohInstances = require('./instances.js');
const { evalPath, areValidChanges, digest } = require('../../utils/change-events.js');
const { defaultBasePermission, permissionsKey, initsKey } = require('../../utils/globals.js');

var changeID = 1;
var logChanges = function(changes) {
	if(debug.enabled('handlers')) {
		for(let change of changes) {
			change.id = changeID++;
			handlersLog(change);
		}
	}
}

/**
 * this function must be called with 'this' as the OH class object
 * @param {Object} client - the client's socket object
 */
function onConnection(client) {
	handlersLog(`socket.io user connected [ID: ${client.socket.id}]`);
	this.clients.set(client.id, client);

	//this will init the whole data transmitting to the user
	let init = () => {
		let proxy = ohInstances.getProxy(this);
		if(typeof proxy[initsKey] === 'undefined') {
			proxy[initsKey] = [];
		}
		proxy[initsKey].push(client.id); //initiates or joins an existing change-event batch. this prevents race condition
	};

	if(this.listenerCount('connection') >= 1) {
		let clientData;
		if(client.socket.handshake.query && client.socket.handshake.query.data) {
			try {
				clientData = JSON.parse(client.socket.handshake.query.data);
			} catch(error) {
				console.error(error);
				console.error(`Can't JSON.parse client's data of client ${client.id}`);
			}
		}
		this.emit('connection', client, clientData, init); //listener must call the init function
	} else {
		init(); //no listeners, so inits automatically
	}
}

function onDisconnection(client, reason) {
	this.clients.delete(client.id);
	handlersLog(`socket.io user disconnected [ID: ${client.socket.id}]`);
	this.emit('disconnection', client, reason);
}

/**
 * checks permissions and then emits the changes to the corresponding clients
 * @param {Array} changes
 */
function onObjectChange(changes) {
	let digestion;
	try {
		digestion = digest(changes, this.permissionTree);
	} catch(error) {
		console.error(error);
		return;
	}

	if(!areValidChanges(digestion.filteredChanges)) return; //in case after digestion the filteredChanges are empty

	if(digestion.requiresDifferentPermissions) { //better case where all changes require the same permission(s)
		let change = digestion.spreadedChanges[0];
		let permissionsNode = this.permissionTree.get(change.path, true);
		//we need only reading permissions
		let must = permissionsNode[permissionsKey].compiled_read.must;
		let or = permissionsNode[permissionsKey].compiled_read.or;

		if(or.length === 0 && must.size <= 1) { //best case where a complete level requires permission, not to specific clients
			let levelName;
			if(must.size === 0) {
				levelName = `level_${defaultBasePermission}`;
			} else if(must.size === 1) {
				levelName = `level_${must.values().next().value}`;
			}
			logChanges(digestion.spreadedChanges);
			if(digestion.spreadedChanges.length > 0) {
				this.io.to(levelName).emit('change', digestion.spreadedChanges);
			} else {
				console.error(new Error('Changes to send for clients were empty'));
			}
		}
		else if(or.length === 1 && must.size === 0) {
			let ioToClients = this.io;
			for(let permission of or[0]) {
				ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
			}
			logChanges(digestion.spreadedChanges);
			if(digestion.spreadedChanges.length > 0) {
				ioToClients.emit('change', digestion.spreadedChanges);
			} else {
				console.error(new Error('Changes to send for clients were empty'));
			}
		}
		else { //check every client and chain them to an IO object that will message them
			let foundClients = false;
			let ioToClients = this.io;

			for(let [id, client] of this.clients) {
				if(client.permissions.verify(permissionsNode, 'read')) {
					ioToClients = ioToClients.to(client.socket.id); //chain client
					foundClients = true;
				}
			}

			if(foundClients) {
				logChanges(digestion.spreadedChanges);
				if(digestion.spreadedChanges.length > 0) {
					ioToClients.emit('change', digestion.spreadedChanges);
				} else {
					console.error(new Error('Changes to send for clients were empty'));
				}
			}
		}
	}
	else { //worst case where different changes require different permissions
		for(let [id, client] of this.clients) {
			let permittedChanges = [];
			for(let change of digestion.spreadedChanges) {
				let permissionsNode = this.permissionTree.get(change.path, true);
				if(client.permissions.verify(permissionsNode, 'read')) {
					permittedChanges.push(change);
				}
			}
			logChanges(permittedChanges);
			if(permittedChanges.length > 0) {
				this.io.to(client.socket.id).emit('change', permittedChanges);
			} else {
				console.error(new Error('Changes to send for client were empty'));
			}
		}
	}

	//handle clients that are pending to be initiated
	if(digestion.hasInits) {
		let proxy = ohInstances.getProxy(this);
		let clientIDs = proxy[initsKey].slice(0); //shallow copy before we delete and revoke this object from the proxy
		delete proxy[initsKey]; //this change will be emitted and ignored next time

		for(let id of clientIDs) {
			let client = this.clients.get(id);
			client.init(this);
		}
	}
}

/**
 * on an object changed received from a client's socket
 * @param {Object} socket 
 * @param {Array} changes 
 */
function onClientObjectChange(client, changes) {
	if(areValidChanges(changes)) {
		let proxy = ohInstances.getProxy(this);
		let spreadedChanges = spread(changes);
		let areTheSame = this.permissionTree.compareChanges(spreadedChanges, 'read');
		let permittedChanges = [];
		let notPermittedChanges = [];

		if(areTheSame) { //better case where all changes require the same permission(s)
			let permissionsNode = this.permissionTree.get(spreadedChanges[0].path, true);
			if(client.permissions.verify(permissionsNode, 'write', false)) {
				permittedChanges = changes; //save bandwith by not using spreadedChanges if not necessary
			} else {
				notPermittedChanges = changes;
			}
		}
		else { //worst case where different changes require different permissions
			for(let change of spreadedChanges) {
				let permissionsNode = this.permissionTree.get(change.path, true);
				if(client.permissions.verify(permissionsNode, 'write', false)) {
					permittedChanges.push(change);
				} else {
					notPermittedChanges.push(change);
				}
			}
		}

		let disapproveChanges = (changesList, reason) => {
			for(let change of changesList) {
				let currentPropertyValue = undefined;
				try {
					let {object, property} = evalPath(proxy, change.path);
					currentPropertyValue = object[ property ];
				} catch(error) {
					console.error(error);
				}
	
				switch(change.type) {
					case 'create':
						change.oldValue = change.value;
						change.value = undefined;
						change.type = 'delete';
						break;
					case 'update':
						change.oldValue = change.value;
						change.value = currentPropertyValue;
						break;
					case 'delete':
						change.oldValue = undefined;
						change.value = currentPropertyValue;
						change.type = 'create';
						break;
				}
				change.reason = reason;
			}
			this.io.to(client.socket.id).emit('change', changesList); //emit previous values to the client
		}
		
		if(notPermittedChanges.length > 0) {
			disapproveChanges(notPermittedChanges, 'Denied: no writing permission'); //reverse not-permitted changes
		}

		if(permittedChanges.length > 0) {
			let commitChanges = (approve=true) => {
				if(approve) { //server is permitting
					for(let change of permittedChanges) {
						try {
							let {object, property} = evalPath(proxy, change.path);
							switch(change.type) {
								case 'create':
								case 'update':
									object[ property ] = change.value;
									break;
								case 'delete':
									delete object[ property ];
									break;
							}
						} catch(error) {
							console.error(error);
						}
					}
				}
				else { //server denies making changes
					disapproveChanges(permittedChanges, 'Denied: overwritten by server');
				}
			}

			if(this.listenerCount('client-change') >= 1) {
				this.emit('client-change', cloneDeep(permittedChanges), client, commitChanges); //hook to catch client's change before emitting to all clients
			}
			else {
				commitChanges();
			}
		}
	} else {
		console.error('changes received from client are not valid', changes);
	}
}

module.exports = exports = {
	onConnection: onConnection,
	onDisconnection: onDisconnection,
	onObjectChange: onObjectChange,
	onClientObjectChange: onClientObjectChange
};