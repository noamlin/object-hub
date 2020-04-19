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
 * checks permissions and then emits the changes to the corresponding clients
 * @param {Array} changes
 */
function onObjectChange(changes) {
	if(changes.length === 0) return;

	let batches = separate2batches(changes, '.'+this.__rootPath); //batches of changes
	for(changes of batches) {
		let requiredPermissions = [];
		iterateCheckPermissions(this.__permissions, Proxserve.splitPath(changes[0].path), requiredPermissions);
		//TODO - what if new created property is an object with child-objects and the child objects don't get check in the permission check

		if(requiredPermissions.length === 0) {
			requiredPermissions.push(['0']);
		}

		let ioToClients = this.__io;

		//best case when only one level requires permissions
		if(requiredPermissions.length === 1) {
			for(let permission of requiredPermissions[0]) {
				ioToClients = ioToClients.to(`level_${permission}`); //chain rooms
			}
			ioToClients.emit('change', changes);
		}
		else { //check every client and chain them to an IO object that will message them
			let foundClients = false;

			for(let [id, socket] of this.clients) {
				let clientSatisfiesPermissions = true;

				for(let levelPermissions of requiredPermissions) { //cascading permissions array of path
					let clientSatisfiesLevel = false;

					for(let permission of levelPermissions) { //permissions of current level in path
						if(socket.OH.permissions.reads[permission]) {
							clientSatisfiesLevel = true;
							break;
						}
					}

					if(!clientSatisfiesLevel) {
						clientSatisfiesPermissions = false;
						break;
					}
				}

				if(clientSatisfiesPermissions) {
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
 * Creates an array of arrays with permissions. permission is required for all levels of the path, but in each level only one permission is enough to be permitted.
 * for example - [[1,2],[2],[1,3]] - means: (1 || 2) && 2 && (1 || 3)
 * @param {Object} permissions 
 * @param {Array} parts 
 * @param {Array} found 
 * @param {Boolean} [isWrite] 
 * @returns {Array.Array} - An array of arrays of permissions required per level of the path
 */
function iterateCheckPermissions(permissions, parts, found, isWrite=false) {
	let readWrite = '__reads';
	if(isWrite) {
		readWrite = '__writes';
	}

	let currPathPermissions = {};
	let part = parts.shift();

	if(isNumeric(part)) {
		let partsCopy = parts.slice(0);

		if(typeof permissions['#'] === 'object') {
			if(permissions['#'][readWrite]) {
				Object.assign(currPathPermissions, permissions['#'][readWrite]);
			}
	
			iterateCheckPermissions(permissions['#'], partsCopy, found);
		}
	}
	
	if(typeof permissions[part] === 'object') {
		if(permissions[part][readWrite]) {
			Object.assign(currPathPermissions, permissions[part][readWrite]);
		}

		iterateCheckPermissions(permissions[part], parts, found);
	}

	currPathPermissions = Object.keys(currPathPermissions);
	if(currPathPermissions.length > 0) {
		found.push(currPathPermissions);
	}
}

function onClientObjectChange(socket, changes) {
	if(Array.isArray(changes)) {
		let batches = separate2batches(changes);
		for(changes of batches) {
			let relatedPermissions = {};
			iterateCheckPermissions(this.__permissions, changes[0].path.split('.'), relatedPermissions, true);
			let permissionsArr = Object.keys(relatedPermissions);
			let hasWritePermission = true;
			for(let permission of permissionsArr) {
				if(!socket.OH.permissions.writes[permission]) {
					hasWritePermission = false; //client doesn't have write permissions
					break;
				}
			}

			for(let change of changes) {
				let parts = Proxserve.splitPath(change.path);
				let currObj = this;

				while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
					currObj = currObj[ parts.shift() ];
				}

				if(parts.length === 1) { //previous loop finished on time
					if(hasWritePermission) { //client has write permission
						switch(change.type) {
							case 'create':
							case 'update':
								currObj[ parts[0] ] = change.value;
								break;
							case 'delete':
								delete currObj[ parts[0] ];
								break;
						}
					}
					else { //client doesn't have write permissions
						switch(change.type) {
							case 'create':
								change.oldValue = currObj[ parts[0] ];
								change.value = undefined;
								change.type = 'delete';
								break;
							case 'update':
								change.oldValue = change.value;
								change.value = currObj[ parts[0] ];
								break;
							case 'delete':
								change.oldValue = undefined;
								change.value = currObj[ parts[0] ];
								change.type = 'create';
								break;
						}
						change.reason = 'Denied [no writing permission]';
					}
				} else {
					console.error('couldn\'t loop completely over path', change);
				}

				if(!hasWritePermission) {
					this.__io.to(socket.id).emit('change', changes);
				}
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