"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');
const { str2VarName } = require('../utils/general.js');

/**
 * @param {Object} this - The OH class object
 */
function onConnection(socket) {
	socket.OH = {
		id: str2VarName(socket.id),
		authLevel: 0
	};
	console.log(`socket.io user connected [ID: ${socket.id}]`);

	let activate = () => {
		this.clients[socket.OH.id] = socket;
		this.io.to(socket.id).emit('create', this[this.rootPath]);
	};
	this.emit('connection', socket, activate);
}

function onDisconnection(socket, reason) {
	delete this.clients[socket.OH.id];
	console.log(`socket.io user disconnected [ID: ${socket.id}]`);
	this.emit('disconnection', socket);
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
	for(let i=0; i<changes.length; i++) {
		delete changes[i].target;
		delete changes[i].proxy;
		delete changes[i].jsonPointer;
	}

	this.io.emit('objectChange', changes);
}

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}, permissions = {}) {
		super();

		let reservedVariables = ['rootPath', 'permissions', 'clients', 'io', 'obj'];
		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this.rootPath = rootPath;
		this.permissions = permissions;
		this.clients = {};
		this.io = socketio(server).of(`/object-hub/${rootPath}`);

		this.io.on('connection', (socket) => {
			onConnection.call(this, socket);
		
			socket.on(rootPath, (data) => {
				//
			});
			
			socket.on('disconnect', onDisconnection.bind(this, socket));
		});

		this[this.rootPath] = ObservableSlim.create(infrastructure, true, onObjectChange.bind(this));
	}

	setPermission(path, permission) {
		this.permissions[path] = permission;
	}
};