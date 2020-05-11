"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const Proxserve = require('proxserve');
const Client = require('../client/client.js');
const { PermissionTree } = require('../permissions/permissions.js');
const handlers = require('./handlers.js');
const { str2VarName, splitPath, evalPath } = require('../../utils/general.js');

var reservedVariables = ['__rootPath', '__permissionTree', '__io', '__delay', 'clients', 'setPermissions', 'setClientPermissions', 'destroy'];

module.exports = exports = class OH extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}) {
		super();

		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this.__rootPath = rootPath;
		this.__permissionTree = new PermissionTree();
		this.clients = new Map();
		this.__io = socketio(server).of(`/object-hub/${rootPath}`);
		this.__delay = 9;

		this.__io.on('connection', (socket) => {
			let client = new Client(socket); //initiate a client with default read-write permissions and sign him to rooms
			handlers.onConnection.call(this, client);
			socket.on('disconnect', handlers.onDisconnection.bind(this, client));
			socket.on('change', handlers.onClientObjectChange.bind(this, client));
		});

		this[rootPath] = new Proxserve(infrastructure, { delay: this.__delay });
		this[rootPath].on('change', handlers.onObjectChange.bind(this));
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
			this.clients.clear();

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

	/**
	 * set a permission per path
	 * @param {String} path 
	 * @param {Array|Number|String|Null} [read] - reading permissions. 'Null' for deletion
	 * @param {Array|Number|String|Null} [write] - writing permissions. 'Null' for deletion
	 */
	setPermissions(path, read, write) {
		this.__permissionTree.set(path, read, write);
	}

	static splitPath(path) {
		return splitPath(path);
	}

	/**
	 * evaluate path according to the OH object or according to another specific object
	 * @param {String} path
	 * @param {Object} [obj]
	 * @returns {Object} - returns {obj, property}
	 */
	static evalPath(path, obj) {
		if(!obj) {
			obj = this;
		}
		return evalPath(path, obj);
	}
};