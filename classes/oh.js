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
		auth: {read: 0, write: 0},
		setAuth: setClientAuth.bind(this, socket)
	};

	console.log(`socket.io user connected [ID: ${socket.id}]`);
	this.clients[socket.OH.id] = socket;
	socket.join('level0'); //join the basic authorization room

	this.emit('connection', socket, socket.handshake.query);
}

function onDisconnection(socket, reason) {
	delete this.clients[socket.OH.id];
	console.log(`socket.io user disconnected [ID: ${socket.id}]`);
	this.emit('disconnection', socket);
}

/**
 * set client's authorization level and update re-assign his rooms
 * @param {Object} socket 
 * @param {Number} read 
 * @param {Number} [write]
 */
function setClientAuth(socket, read, write) {
	if(Number.isInteger(write)) {
		socket.OH.auth.write = write;
	}

	if(read > socket.OH.auth.read) {
		for(let i = socket.OH.auth.read+1; i <= read; i++) {
			socket.join(`level${i}`);
		}
	} else if(read < socket.OH.auth.read) {
		for(let i = socket.OH.auth.read; i > read; i--) {
			socket.leave(`level${i}`);
		}
	}
	socket.OH.auth.read = read;
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
		item.path = `${this._rootPath}.${item.currentPath}`;
		delete item.currentPath;
		delete item.target;
		delete item.proxy;
		delete item.jsonPointer;
	}

	this._io.emit('objectChange', changes);
}

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}, permissions = {}) {
		super();

		let reservedVariables = ['_rootPath', '_permissions', 'clients', 'io', 'setPermission'];
		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this._rootPath = rootPath;
		this._permissions = permissions;
		this.clients = {};
		this._io = socketio(server).of(`/object-hub/${rootPath}`);

		this._io.on('connection', (socket) => {
			onConnection.call(this, socket);
			
			socket.on('disconnect', onDisconnection.bind(this, socket));
		});

		this[rootPath] = ObservableSlim.create(infrastructure, true, onObjectChange.bind(this));
	}

	setPermission(path, permission) {
		this._permissions[path] = permission;
	}
};