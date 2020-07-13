/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

const debug = require('debug');
const handlersLog = debug('handlers');
const { cloneDeep } = require('lodash');
const ohInstances = require('./instances.js');
const { evalPath, areValidChanges, digest } = require('../../utils/change-events.js');
const { defaultBasePermission, permissionsKey, forceEventChangeKey } = require('../../utils/globals.js');

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

	//this will init the whole data transmitting to the user
	let init = () => {
		let proxy = ohInstances.getProxy(this);
		proxy[forceEventChangeKey] = 1;
		this.pendingClients.set(client.id, client);
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
		digestion = digest(changes, this);
	} catch(error) {
		console.error(error);
		return;
	}

	//check that filteredChanges are not empty in order not to send empty messages to clients
	if(areValidChanges(digestion.filteredChanges)) {
		if(!digestion.requiresDifferentPermissions) { //better case where all changes require the same permission(s)
			let change = digestion.filteredChanges[0];
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
				logChanges(digestion.filteredChanges);
				if(digestion.filteredChanges.length > 0) {
					this.io.to(levelName).emit('change', digestion.filteredChanges);
				} else {
					console.error(new Error('Changes to send for clients were empty'));
				}
			}
			else if(or.length === 1 && must.size === 0) {
				let ioToClients = this.io;
				for(let permission of or[0]) {
					ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
				}
				logChanges(digestion.filteredChanges);
				if(digestion.filteredChanges.length > 0) {
					ioToClients.emit('change', digestion.filteredChanges);
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
					logChanges(digestion.filteredChanges);
					if(digestion.filteredChanges.length > 0) {
						ioToClients.emit('change', digestion.filteredChanges);
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
				}
				//not actually needed because iterating over all clients means some of them won't be permitted to read any change
				/*else {
					console.error(new Error('Changes to send for client were empty'));
				}*/
			}
		}
	}

	//handle clients that are pending to be initiated
	if(this.pendingClients.size > 0) {
		for(let [id, client] of this.pendingClients) {
			this.pendingClients.delete(id);
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
	let digestion;
	try {
		digestion = digest(changes, this);
	} catch(error) {
		console.error(error);
		return;
	}

	let permittedChanges = [];
	let notPermittedChanges = [];

	let proxy = ohInstances.getProxy(this);

	//check that filteredChanges are not empty
	if(areValidChanges(digestion.filteredChanges)) {
		if(!digestion.requiresDifferentPermissions) { //better case where all changes require the same permission(s)
			let permissionsNode = this.permissionTree.get(digestion.filteredChanges[0].path, true);
			let isPermitted = client.permissions.verify(permissionsNode, 'write', false);
			if(!isPermitted) {
				notPermittedChanges = digestion.filteredChanges; //client isn't permitted to anything
			}
		}

		if(notPermittedChanges.length === 0) { //will skip this part if discovered client isn't permitted to anything
			for(let change of digestion.filteredChanges) {
				let strictCheck = false;
				if(change.type !== 'delete' && typeof change.value === 'object') { //trying to create a new object
					strictCheck = true;
				} else { //maybe trying to overwrite/delete an existing object
					let { value } = evalPath(proxy, change.path);
					if(typeof value === 'object') {
						strictCheck = true;
					}
				}
	
				if(strictCheck) {
					let permissionsNode = this.permissionTree.get(change.path, true);
					let isPermitted = client.permissions.recursiveVerify(permissionsNode, 'write', false);
					if(!isPermitted) {
						notPermittedChanges.push(change);
					} else {
						permittedChanges.push(change);
					}
				} else { //changing a primitive value
					permittedChanges.push(change);
				}
			}
		}

		let disapproveChanges = (changesList, reason='') => {
			if(changesList.length === 0) return;

			let reversedChanges = [];
			for(let change of changesList) {
				switch(change.type) {
					case 'create':
						reversedChanges.push({
							path: change.path,
							oldValue: change.value,
							value: undefined,
							type: 'delete'
						});
						break;
					case 'update':
						reversedChanges.push({
							path: change.path,
							oldValue: change.value,
							value: client.prepareObject(this, change.path),
							type: 'update'
						});
						break;
					case 'delete':
						reversedChanges.push({
							path: change.path,
							oldValue: undefined,
							value: client.prepareObject(this, change.path),
							type: 'create'
						});
						break;
				}
				if(reason.length > 0) {
					reversedChanges[reversedChanges.length - 1].reason = reason;
				}
			}
			this.io.to(client.socket.id).emit('change', reversedChanges); //emit previous values to the client
		}
		
		
		disapproveChanges(notPermittedChanges, 'Denied: no writing permission'); //reverse not-permitted changes

		if(permittedChanges.length > 0) {
			let approved = [];
			let disapproved = [];

			/**
			 * 
			 * @param {Change} change - a reference to a change from 'permittedChanges'
			 * @param {Boolean} [allow] - allow or deny
			 * @param {String} [reason] - reason is denied
			 */
			let commitChange = (change, allow=true, reason='Denied: overwritten by server') => {
				if(allow) {
					approved.push(change);
				} else {
					disapproved.push(change);
					if(reason.length > 0) change.reason = reason;
				}

				if(approved.length + disapproved.length === permittedChanges.length) { //committed all
					applyChanges();
				}
			}
			/**
			 * 
			 * @param {Boolean} [approve] - approve changes and alter the object for all or send a rejection (old values) to the client
			 * @param {String} [reason] - send a reason of rejection to the client
			 */
			let applyChanges = () => {
				//first of all disapprove so client's values will be reversed and synced with all other clients
				disapproveChanges(disapproved, '');

				for(let change of approved) {
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

			if(this.listenerCount('client-change') >= 1) {
				this.emit('client-change', permittedChanges, client, commitChange); //hook to catch client's change before emitting to all clients
			}
			else {
				approved = permittedChanges;
				applyChanges();
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