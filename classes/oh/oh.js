/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

const EventEmitter = require('events');
const ohInstances = require('./instances.js');
const socketio = require('socket.io');
const Proxserve = require('proxserve');
const Client = require('../client/client.js');
const { PermissionTree } = require('../permissions/permissions.js');
const handlers = require('./handlers.js');
const { str2VarName } = require('../../utils/variables.js');
const { splitPath, evalPath } = require('../../utils/change-events.js');

class OHinstance extends EventEmitter {
	constructor(domain, io) {
		super();

		this.domain = domain;
		this.io = io;
		this.delay = 9;
		this.permissionTree = new PermissionTree();
		this.clients = new Map();
		this.pendingClients = new Map();

		this.io.on('connection', (socket) => {
			let client = new Client(socket); //initiate a client with default read-write permissions and sign him to rooms
			handlers.onConnection.call(this, client);
			socket.on('disconnect', handlers.onDisconnection.bind(this, client));
			socket.on('change', handlers.onClientObjectChange.bind(this, client));
		});
	}

	get [Symbol.toStringTag]() {
		return 'OH!';
	}

	/**
	 * destroy the instance and the connections
	 * @param {Function} [cb] - a callback function
	 */
	destroy(cb) {
		let proxy = ohInstances.getProxy(this);
		let originalObj = proxy.getOriginalTarget();
		setImmediate(() => {
			//first disconnect all clients and trigger all 'disconnection' events which might still be using the proxy object
			let socketsKeys = Object.keys(this.io.connected);
			for(let key of socketsKeys) {
				this.io.connected[key].disconnect(true);
			}
			this.io.removeAllListeners('connection');
			this.clients.clear();
			this.pendingClients.clear();

			setImmediate(() => {
				Proxserve.destroy(proxy);
				delete this.io;

				setImmediate(() => {
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
		this.permissionTree.set(path, read, write);
	}
};

module.exports = exports = class OH {
	constructor(domain, server, infrastructure = {}) {
		if(str2VarName(domain) !== domain) {
			throw new Error('root path must match a valid object\'s property name');
		}

		let theInstance = new OHinstance(domain, socketio(server).of(`/oh-${domain}`));
		let proxy = new Proxserve(infrastructure, { delay: theInstance.delay });
		ohInstances.set(proxy, theInstance);
		proxy.on('change', handlers.onObjectChange.bind(theInstance));
		return proxy;
	}

	/**
	 * get the proxy's OH-instance
	 * @param {Proxy} proxy 
	 */
	static getInstance(proxy) {
		return ohInstances.getInstance(proxy);
	}

	/**
	 * split's path to an array of segments
	 * @param {String} path 
	 */
	static splitPath(path) {
		return splitPath(path);
	}

	/**
	 * evaluate path according to the OH object or according to another specific object
	 * @param {Object|Proxy} obj
	 * @param {String} path
	 * @returns {Object} - returns {obj, property}
	 */
	static evalPath(obj, path) {
		return evalPath(obj, path);
	}
};