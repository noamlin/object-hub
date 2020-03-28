"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');
const { str2VarName } = require('../utils/general.js');
const { cloneDeep } = require('lodash');

/**
 * prepare the object to send to the client by deleting the properties the client is unauthorized to view
 * @param {Object} obj 
 * @param {Object} permissions 
 * @param {Number} clientReadAuth 
 */
function prepareObjectForClient(obj, permissions, clientReadAuth) {
	obj = cloneDeep(obj);
	delete obj.__getTarget;
	let props = Object.getOwnPropertyNames(obj);
	return obj;
}

/**
 * @param {Object} this - The OH class object
 */
function onConnection(socket) {
	socket.OH = {
		id: str2VarName(socket.id),
		auth: {read: {}, write: {}},
		setAuth: setClientAuth.bind(this, socket)
	};

	console.log(`socket.io user connected [ID: ${socket.id}]`);
	this.clients[socket.OH.id] = socket;

	let data = {};
	data[this._rootPath] = prepareObjectForClient(this[this._rootPath].__getTarget, this._permissions, socket.OH.auth.read);
	//MUST BE CALLED. this inits the whole data transmitting to the user
	let init = () => {
		this._io.to(socket.id).emit('init', data);
		socket.join('level0'); //join the basic authorization room
	};

	this.emit('connection', socket, socket.handshake.query, init);
}

function onDisconnection(socket, reason) {
	delete this.clients[socket.OH.id];
	console.log(`socket.io user disconnected [ID: ${socket.id}]`);
	this.emit('disconnection', socket);
}

/**
 * set client's authorization level and update re-assign his rooms
 * @param {Object} socket 
 * @param {Number} reads
 * @param {Number} [writes]
 */
function setClientAuth(socket, reads, writes) {
	//handle write
	if(typeof writes !== 'undefined') {
		if(Number.isInteger(writes)) {
			writes = [writes];
		}
		socket.OH.auth.write = {};
		for(let item of writes) {
			socket.OH.auth.write[item] = true; //always use hashmap
		}
	}

	//handle read
	if(Number.isInteger(reads)) {
		reads = [reads];
	}
	let newReads = {};
	for(let item of reads) {
		newReads[item] = true; //always use hashmap
	}

	let oldReadKeys = Object.getOwnPropertyNames(socket.OH.auth.read);
	let newReadKeys = Object.getOwnPropertyNames(newReads);

	for(let authNum of newReadKeys) {
		if(!socket.OH.auth.read[authNum]) { //new inserted auth number didn't exist before
			socket.join(`level${authNum}`);
		}
	}
	for(let authNum of oldReadKeys) {
		if(!newReads[authNum]) { //old auth number that is about to be removed
			socket.leave(`level${authNum}`);
		}
	}

	socket.OH.auth.read = newReads;
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

	this._io.emit('change', changes);
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