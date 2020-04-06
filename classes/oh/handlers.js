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
	this.clients[socket.OH.id] = socket;

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
	delete this.clients[socket.OH.id];
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

	let relatedPermissions = {};
	iterateCheckPermissions(this.__permissions, changes[0].path.split('.'), relatedPermissions);
	let permissionsArr = Object.keys(relatedPermissions);

	if(permissionsArr.length === 0 || (permissionsArr.length === 1 && permissionsArr[0] === '0')) {
		permissionsArr.push('0');
	}

	for(let permission of permissionsArr) {
		this.__io.to(`level_${permission}`).emit('change', changes);
	}
}

function iterateCheckPermissions(permissions, parts, found) {
	let part = parts.shift();

	if(isNumeric(part)) {
		let partsCopy = parts.slice(0);

		if(typeof permissions['#'] === 'object') {
			if(permissions['#'].__reads) {
				Object.assign(found, permissions['#'].__reads);
			}
	
			iterateCheckPermissions(permissions['#'], partsCopy, found);
		}
	}
	
	if(typeof permissions[part] === 'object') {
		if(permissions[part].__reads) {
			Object.assign(found, permissions[part].__reads);
		}

		iterateCheckPermissions(permissions[part], parts, found);
	}
}

module.exports = exports = {
	onConnection: onConnection,
	onDisconnection: onDisconnection,
	onObjectChange: onObjectChange
};