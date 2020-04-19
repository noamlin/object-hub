"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const Proxserve = require('proxserve');
const handlers = require('./handlers.js');
const { realtypeof, str2VarName } = require('../../utils/general.js');

var reservedVariables = ['__rootPath', '__permissions', '__io', 'clients', 'setPermission', 'setClientPermissions', 'destroy'];

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}) {
		super();

		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this.__rootPath = rootPath;
		this.__permissions = {};
		this.clients = new Map();
		this.__io = socketio(server).of(`/object-hub/${rootPath}`);

		this.__io.on('connection', (socket) => {
			handlers.onConnection.call(this, socket);
			socket.on('disconnect', handlers.onDisconnection.bind(this, socket));
			socket.on('change', handlers.onClientObjectChange.bind(this, socket));
		});

		this[rootPath] = new Proxserve(infrastructure);
		this[rootPath].on('change', handlers.onObjectChange.bind(this));
	}

	/**
	 * set a permission per path. converts either single or multiple values to a hashmap
	 * @param {String} path 
	 * @param {Array|Number|String} writes - writing permissions
	 * @param {Array|Number|String} [reads] - reading permissions 
	 */
	setPermission(path, writes, reads=0) {
		//check if path (or some of it) is inside an array
		//let hasDigitsRegexp = new RegExp(/\.\d+(\.|$)/);
		//if(hasDigitsRegexp.test(path)) {
		let parts = path.split('.'); //root.sub.1.alt.2 --> [root,sub,1,alt,2]
		let part;
		let pathObj = this.__permissions;
		for(part of parts) {
			if(typeof pathObj[part] !== 'object') {
				pathObj[part] = {};
			}
			pathObj = pathObj[part];
		}
		
		pathObj.__reads = {};
		pathObj.__writes = {};

		if(!Array.isArray(writes)) {
			writes = [writes];
		}
		for(let write of writes) {
			if(write !== 0 && write !== '0') {
				pathObj.__writes[ write ] = true;
			}
		}

		if(!Array.isArray(reads)) {
			reads = [reads];
		}
		for(let read of reads) {
			if(read !== 0 && read !== '0') {
				pathObj.__reads[ read ] = true;
			}
		}
	}

	/**
	 * set client's authorization level and update re-assign his rooms
	 * @param {Object} socket 
	 * @param {Number} writes
	 * @param {Number} [reads]
	 */
	setClientPermissions(socket, newWrites, newReads) {
		//handle write
		socket.OH.permissions.writes = {};
		socket.OH.permissions.writes[ socket.OH.id ] = true; //client id
		if(!Array.isArray(newWrites)) {
			newWrites = [newWrites];
		}
		for(let write of newWrites) {
			if(write !== 0 && write !== '0') {
				socket.OH.permissions.writes[ write ] = true;
			}
		}
	
		//handle read
		let oldReads = socket.OH.permissions.reads;
		socket.OH.permissions.reads = {};
		socket.OH.permissions.reads[ socket.OH.id ] = true; //client id
		let readsType = realtypeof(newReads);
		if(readsType !== 'Undefined' && readsType !== 'Null') {
			if(readsType !== 'Array') {
				newReads = [newReads];
			}
			for(let read of newReads) {
				if(read !== 0 && read !== '0') {
					socket.OH.permissions.reads[ read ] = true;
				}
			}
		}

		let oldReadsType = realtypeof(oldReads);
		if(oldReadsType === 'Undefined' || oldReadsType === 'Null') {
			oldReads = {};
		}
		let oldReadKeys = Object.keys(oldReads);
		for(let read of oldReadKeys) {
			if(!socket.OH.permissions.reads[ read ]) { //doesn't exist anymore
				socket.leave(`level_${read}`);
			}
		}

		let newReadKeys = Object.keys(socket.OH.permissions.reads);
		for(let read of newReadKeys) {
			if(!oldReads[ read ]) { //a completely new reading permission
				socket.join(`level_${read}`);
			}
		}
	}

	/**
	 * destroy the instance and the connections
	 * @param {Function} [cb] - a callback function
	 */
	destroy(cb) {
		let originalObj = this[this.__rootPath].getOriginalTarget();
		setImmediate(() => {
			//first disconnect all clients and trigger all 'disconnection' events which might still be using the proxy object
			let socketsKeys = Object.keys(this.__io.connected);
			for(let key of socketsKeys) {
				this.__io.connected[key].disconnect(true);
			}
			this.__io.removeAllListeners('connection');

			setImmediate(() => {
				Proxserve.destroy(this[this.__rootPath]);

				setImmediate(() => {
					delete this[this.__rootPath];
					for(let item of reservedVariables) {
						delete this[item];
					}

					if(typeof cb === 'function') {
						cb( originalObj );
					}
				});
			});
		});
	}
};