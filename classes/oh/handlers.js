"use strict"

const { str2VarName, isNumeric } = require('../../utils/general.js');
const { prepareObjectForClient } = require('./object-manipulations.js');
const Proxserve = require('proxserve');

/**
 * @param {Object} this - The OH class object
 */
function onConnection(socket) {
	socket.OH = {
		id: str2VarName(socket.id),
		permissions: {}
	};
	this.setClientPermissions(socket, 0, 0); //initiate a client with no special read-write permissions

	console.log(`socket.io user connected [ID: ${socket.id}]`);
	this.clients.set(socket.OH.id, socket);

	//MUST BE CALLED. this inits the whole data transmitting to the user
	let init = () => {
		let data = {
			obj: prepareObjectForClient.call(this, socket.OH.permissions.reads),
			id: socket.OH.id,
			reads: socket.OH.permissions.reads
		};
		this.__io.to(socket.id).emit('init', data);
		socket.join('level_0'); //join the basic permitted room
	};

	this.emit('connection', socket, socket.handshake.query, init);
}

function onDisconnection(socket, reason) {
	this.clients.delete(socket.OH.id);
	console.log(`socket.io user disconnected [ID: ${socket.id}]`);
	this.emit('disconnection', socket, reason);
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
 * get the compiled permissions of a path
 * @param {String} path 
 */
function getPathPermissions(path) {
	let requiredPermissions = null;
	let parts = Proxserve.splitPath(path);
	let currentObj = this.__permissions;
	for(let part of parts) {
		if(typeof currentObj[part] !== 'undefined') {
			currentObj = currentObj[part];
			if(typeof currentObj.__compiled === 'object') {
				requiredPermissions = currentObj.__compiled;
			}
		}
		else {
			break;
		}
	}
	if(requiredPermissions === null) {
		requiredPermissions = {
			writes: { must: [], or: [] },
			reads: { must: [], or: [] }
		};
	}
	return requiredPermissions;
}

/**
 * checks permissions and then emits the changes to the corresponding clients
 * @param {Array} changes
 */
function onObjectChange(changes) {
	if(changes.length === 0) return;

	let batches = separate2batches(changes, this.__rootPath); //batches of changes
	for(changes of batches) {
		let requiredPermissions = getPathPermissions.call(this, changes[0].path);
		requiredPermissions = requiredPermissions.reads; //only reading permissions
		
		//TODO - what if new created property is an object with child-objects and the child objects don't get check in the permission check

		if(requiredPermissions.or.length === 0) { //best case where a complete level requires permission, not to specific clients
			if(requiredPermissions.must.length === 0) {
				this.__io.to('level_0').emit('change', changes);
			}
			else {
				let ioToClients = this.__io;
				for(let permission of requiredPermissions.must) {
					ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
				}
				ioToClients.emit('change', changes);
			}
		}
		else if(requiredPermissions.or.length === 1 && requiredPermissions.must.length === 0) {
			let ioToClients = this.__io;
			for(let permission of requiredPermissions.or[0]) {
				ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
			}
			ioToClients.emit('change', changes);
		}
		else { //check every client and chain them to an IO object that will message them
			let foundClients = false;
			let ioToClients = this.__io;

			for(let [id, socket] of this.clients) {
				let clientPermissions = socket.OH.permissions.reads;

				let clientSatisfiesMust = true;
				for(let mustPermission of requiredPermissions.must) {
					if(!clientPermissions[mustPermission]) {
						clientSatisfiesMust = false;
						break;
					}
				}

				let clientSatisfiesOr;
				if(clientSatisfiesMust) { //this test only matters if client satisfied the 'must' permissions
					clientSatisfiesOr = true;
					for(let orPermissions of requiredPermissions.or) {
						let clientSatisfiesCurrentLevel = false;
						for(let permission of orPermissions) {
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
function onClientObjectChange(socket, changes) {
	if(Array.isArray(changes)) {
		let batches = separate2batches(changes);
		for(changes of batches) {
			let requiredPermissions = getPathPermissions.call(this, changes[0].path);
			requiredPermissions = requiredPermissions.writes; //only writing permissions

			let clientPermissions = socket.OH.permissions.writes;
			let isPermitted = true;

			//check 'must' permissions
			for(let permission of requiredPermissions.must) {
				if(!clientPermissions[permission]) {
					isPermitted = false;
					break;
				}
			}

			if(isPermitted) {
				//check 'or' permissions
				for(let orPermissions of requiredPermissions.or) {
					let clientSatisfiesCurrentLevel = false;
					for(let permission of orPermissions) {
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

			let parts = Proxserve.splitPath(changes[0].path);
			let currentObj = this;
			while(typeof currentObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
				currentObj = currentObj[ parts.shift() ];
			}

			if(parts.length === 1) { //previous loop finished on time
				for(let change of changes) {
					if(isPermitted) { //client has writing permission
						switch(change.type) {
							case 'create':
							case 'update':
								currentObj[ parts[0] ] = change.value;
								break;
							case 'delete':
								delete currentObj[ parts[0] ];
								break;
						}
					} else { //not permitted
						switch(change.type) {
							case 'create':
								change.oldValue = currentObj[ parts[0] ];
								change.value = undefined;
								change.type = 'delete';
								break;
							case 'update':
								change.oldValue = change.value;
								change.value = currentObj[ parts[0] ];
								break;
							case 'delete':
								change.oldValue = undefined;
								change.value = currentObj[ parts[0] ];
								change.type = 'create';
								break;
						}
						change.reason = 'Denied: no writing permission';
					}
				}

				if(!isPermitted) {
					this.__io.to(socket.id).emit('change', changes); //emit previous values to the unauthorized client
				}
			} else {
				console.error('couldn\'t loop completely over path', change);
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