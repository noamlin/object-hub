"use strict"

const { str2VarName, isNumeric } = require('../../utils/general.js');
const { prepareObjectForClient } = require('./object-manipulations.js');

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
 * 
 * @param {Array} changes - a changes array that holds objects like this:
 * currentPath:"players.man1"
 * jsonPointer:"/players/man1"
 * newValue:"john"
 * previousValue:undefined
 * property:"undefined"
 * proxy:Proxy {objecthubWCXgnQL4_cWpkuRAAAA: "/object-hub#WCXgn0QL4_cWpkuRAAAA", objecthubQsyjL3olnYUXcjEJAAAB: "/object-hub#QsyjL3olnYUXcjEJAAAB", __targetPosition: 1}
 * target:Object {objecthubWCXgnQL4_cWpkuRAAAA: "/object-hub#WCXgn0QL4_cWpkuRAAAA", objecthubQsyjL3olnYUXcjEJAAAB: "/object-hub#QsyjL3olnYUXcjEJAAAB", __targetPosition: 1}
 * type: "delete"|"add"|"update"
 */
function onObjectChange(changes) {
	for(let item of changes) {
		item.path = `${this.__rootPath}.${item.currentPath}`;
		delete item.currentPath;
		delete item.target;
		delete item.proxy;
		delete item.jsonPointer;
	}

	//TODO - what if new created property is an object with child-objects and the child objects don't get caught in the permission check

	let requiredPermissions = [];
	iterateCheckPermissions(this.__permissions, changes[0].path.split('.'), requiredPermissions);

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

			for(let levelPermissions of requiredPermissions) { //permissions array per level of path
				let clientSatisfiesLevel = false;

				for(let permission of levelPermissions) { //permissions of current level
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
			let parts = change.path.split('.');
			let currObj = this;

			while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
				currObj = currObj[ parts.shift() ];
			}

			if(parts.length === 1) { //previous loop finished on time
				if(hasWritePermission) { //client has write permission
					switch(change.type) {
						case 'add':
						case 'update':
							currObj[ parts[0] ] = change.newValue;
							break;
						case 'delete':
							delete currObj[ parts[0] ];
							break;
					}
				}
				else { //client doesn't have write permissions
					switch(change.type) {
						case 'add':
							change.previousValue = currObj[ parts[0] ];
							change.newValue = undefined;
							change.type = 'delete';
							break;
						case 'update':
							change.previousValue = change.newValue;
							change.newValue = currObj[ parts[0] ];
							break;
						case 'delete':
							change.previousValue = undefined;
							change.newValue = currObj[ parts[0] ];
							change.type = 'add';
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
	} else {
		console.error('changes received from server are not an array', changes);
	}
}

module.exports = exports = {
	onConnection: onConnection,
	onDisconnection: onDisconnection,
	onObjectChange: onObjectChange,
	onClientObjectChange: onClientObjectChange
};