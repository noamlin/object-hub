"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');
const handlers = require('./handlers.js');
const { realtypeof, str2VarName } = require('../../utils/general.js');

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}) {
		super();

		let reservedVariables = ['_rootPath', '_permissions', 'clients', 'io', 'setPermission'];
		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this._rootPath = rootPath;
		this._permissions = {};
		this.clients = {};
		this._io = socketio(server).of(`/object-hub/${rootPath}`);

		this._io.on('connection', (socket) => {
			handlers.onConnection.call(this, socket);
			
			socket.on('disconnect', handlers.onDisconnection.bind(this, socket));
		});

		this[rootPath] = ObservableSlim.create(infrastructure, true, handlers.onObjectChange.bind(this));
	}

	/**
	 * set a permission per path. converts either single or multiple values to a hashmap
	 * @param {String} path 
	 * @param {Array|Number|String} writes - writing permissions
	 * @param {Array|Number|String} [reads] - reading permissions 
	 */
	setPermission(path, writes, reads=0) {
		this._permissions[path] = {
			reads: {},
			writes: {}
		};

		if(Array.isArray(writes)) {
			for(let write of writes) {
				this._permissions[path].writes[ write ] = true;
			}
		}
		else {
			this._permissions[path].writes[ writes ] = true;
		}

		if(Array.isArray(reads)) {
			for(let read of reads) {
				this._permissions[path].reads[ read ] = true;
			}
		}
		else {
			this._permissions[path].reads[ reads ] = true;
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
		if(Array.isArray(newWrites)) {
			for(let write of newWrites) {
				socket.OH.permissions.writes[ write ] = true;
			}
		} else {
			socket.OH.permissions.writes[ newWrites ] = true;
		}
	
		//handle read
		let oldReads = socket.OH.permissions.reads;
		socket.OH.permissions.reads = {};
		socket.OH.permissions.reads[ socket.OH.id ] = true; //client id
		let readsType = realtypeof(newReads);
		if(readsType !== 'Undefined' && readsType !== 'Null') {
			if(readsType === 'Array') {
				for(let read of newReads) {
					socket.OH.permissions.reads[ read ] = true;
				}
			} else {
				socket.OH.permissions.reads[ newReads ] = true;
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
};