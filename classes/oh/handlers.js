"use strict"

const { evalPath } = require('../../utils/general.js');
const { cloneDeep } = require('lodash');
const { defaultBasePermission } = require('../permissions/permissions.js');

/**
 * this function must be called with 'this' as the OH class object
 * @param {Object} client - the client's socket object
 */
function onConnection(client) {
	console.log(`socket.io user connected [ID: ${client.socket.id}]`);
	this.clients.set(client.id, client);

	//this will init the whole data transmitting to the user
	let init = () => {
		setTimeout(() => { //client's connection might triggered changes. don't prepare his initial object until these changes are digested
			let data = {
				obj: client.prepareObject(this),
				id: client.id
			};
			this.__io.to(client.socket.id).emit('init', data);
		}, this.__delay * 2);
	};

	if(this.listenerCount('connection') >= 1) {
		this.emit('connection', client, client.socket.handshake.query, init); //listener must call the init function
	} else {
		init(); //no listeners, so inits automatically
	}
}

function onDisconnection(client, reason) {
	this.clients.delete(client.id);
	console.log(`socket.io user disconnected [ID: ${client.socket.id}]`);
	this.emit('disconnection', client, reason);
}

/**
 * @typedef {Object} Change - each change emitted from Proxserve
 * @property {String} path - the path from the object listening to the property that changed
 * @property {*} value - the new value that was set
 * @property {*} oldValue - the previous value
 * @property {String} type - the type of change. may be - "create"|"update"|"delete"
 */
/**
 * filters changes to ordered batches with the same path and updates the paths.
 * hopefully these changes will always belong to one batch (all changes will have the same path.
 * like the batch of changes created from array manipulation)
 * @param {Array.Change} changes
 * @param {String} [prepend2path] - prepend a property name to all paths
 */
function separate2batches(changes, prepend2path='') {
	let batches = [];
	let lastPath;
	let lastIndex = -1;

	for(let i=0; i < changes.length; i++) {
		changes[i].path = `${prepend2path}${changes[i].path}`;
		if(lastIndex === -1) {
			lastPath = changes[i].path;
			lastIndex = i;
		}
		else if(changes[i].path !== lastPath) {
			batches.push(changes.slice(lastIndex, i));
			lastPath = changes[i].path;
			lastIndex = i;
		}
	}
	batches.push(changes.slice(lastIndex));

	return batches;
}

/**
 * checks permissions and then emits the changes to the corresponding clients
 * @param {Array} changes
 */
function onObjectChange(changes) {
	if(changes.length === 0) return;

	let batches = separate2batches(changes, this.__rootPath); //batches of changes
	for(changes of batches) {
		let requiredPermissions = this.__permissionTree.get(changes[0].path);
		//we need only reading permissions
		let must = requiredPermissions.compiled_read.must;
		let or = requiredPermissions.compiled_read.or;
		
		//TODO - what if new created property is an object with child-objects and the child objects don't get check in the permission check

		if(or.length === 0 && must.length <= 1) { //best case where a complete level requires permission, not to specific clients
			this.__io.to(`level_${must[0]}`).emit('change', changes);
		}
		else if(or.length === 1 && must.length === 0) {
			let ioToClients = this.__io;
			for(let permission of or[0]) {
				ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
			}
			ioToClients.emit('change', changes);
		}
		else { //check every client and chain them to an IO object that will message them
			let foundClients = false;
			let ioToClients = this.__io;

			for(let [id, client] of this.clients) {
				let clientPermissions = client.permissions;

				let clientSatisfiesMust = true;
				for(let mustPermission of must) {
					if(!clientPermissions[mustPermission]) {
						clientSatisfiesMust = false;
						break;
					}
				}

				let clientSatisfiesOr;
				if(clientSatisfiesMust) { //this test only matters if client satisfied the 'must' permissions
					clientSatisfiesOr = true;
					for(let orLevelPermissions of or) {
						let clientSatisfiesCurrentLevel = false;
						for(let permission of orLevelPermissions) {
							if(clientPermissions[permission]) {
								clientSatisfiesCurrentLevel = true;
								break;
							}
						}

						if(!clientSatisfiesCurrentLevel) {
							clientSatisfiesOr = false;
							break;
						}
					}
				}

				if(clientSatisfiesMust && clientSatisfiesOr) {
					ioToClients = ioToClients.to(socket.id); //chain client
					foundClients = true;
				}
			}

			if(foundClients) {
				ioToClients.emit('change', changes);
			}
		}
	}
}

/**
 * on an object changed received from a client's socket
 * @param {Object} socket 
 * @param {Array} changes 
 */
function onClientObjectChange(client, changes) {
	if(Array.isArray(changes)) {
		let batches = separate2batches(changes);
		for(changes of batches) {
			let requiredPermissions = getPathPermissions.call(this, changes[0].path);
			//TODO - what if client creates a whole new object that one of his sub-objects requires different permissions and the client is not permitted
			let must = requiredPermissions.writes.must; //only writing permissions
			let or = requiredPermissions.writes.or; //only writing permissions

			let clientPermissions = client.permissions.write;
			let isPermitted = true;

			//check 'must' permissions
			for(let permission of must) {
				if(!clientPermissions[permission]) {
					isPermitted = false;
					break;
				}
			}

			if(isPermitted) {
				//check 'or' permissions
				for(let orLevelPermissions of or) {
					let clientSatisfiesCurrentLevel = false;
					for(let permission of orLevelPermissions) {
						if(clientPermissions[permission]) {
							clientSatisfiesCurrentLevel = true;
							break;
						}
					}

					if(!clientSatisfiesCurrentLevel) {
						isPermitted = false;
						break;
					}
				}
			}

			try {
				let {object, property} = evalPath(this, changes[0].path);

				let commitChanges = (approve=true, reason='Denied: overwritten by server') => {
					if(Array.isArray(changes)) {
						if(approve) { //is permitted
							for(let change of changes) {
								switch(change.type) {
									case 'create':
									case 'update':
										object[ property ] = change.value;
										break;
									case 'delete':
										delete object[ property ];
										break;
								}
							}
						}
						else { //not approved to make changes, whether because of permissions or listener hook
							for(let change of changes) {
								switch(change.type) {
									case 'create':
										change.oldValue = object[ property ];
										change.value = undefined;
										change.type = 'delete';
										break;
									case 'update':
										change.oldValue = change.value;
										change.value = object[ property ];
										break;
									case 'delete':
										change.oldValue = undefined;
										change.value = object[ property ];
										change.type = 'create';
										break;
								}
								change.reason = reason;
							}
		
							this.__io.to(client.socket.id).emit('change', changes); //emit previous values to the client
						}
					}
				}

				if(isPermitted) {
					if(this.listenerCount('client-change') >= 1) {
						this.emit('client-change', cloneDeep(changes), client, commitChanges); //hook to catch client's change before emitting to all clients
					}
					else {
						commitChanges();
					}
				}
				else { //not permitted
					commitChanges(false, 'Denied: no writing permission'); //emit previous values to the unauthorized client
				}
			} catch(error) {
				console.error(error);
			}
		}
	} else {
		console.error('changes received from client are not an array', changes);
	}
}

module.exports = exports = {
	onConnection: onConnection,
	onDisconnection: onDisconnection,
	onObjectChange: onObjectChange,
	onClientObjectChange: onClientObjectChange
};