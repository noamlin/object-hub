/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict";

const { cloneDeep } = require('lodash');
const ohInstances = require('../oh/instances.js');
const { ClientPermissions } = require('../permissions/permissions.js');
const { defaultBasePermission } = require('../../utils/globals.js');
const { str2VarName, realtypeof } = require('../../utils/variables.js');
const Proxserve = require('proxserve');

module.exports = exports = class Client {
	constructor(socket) {
		this.id = str2VarName(socket.id);
		this.isInitiated = false;
		this.socket = socket;
		this.permissions = new ClientPermissions([defaultBasePermission, this.id]);
		this.setPermissions(null, null); //initiates permissions with defaults
	}

	/**
	 * set client's reading & writing authorization level and assign him to rooms
	 * @param {Array|Number|String|Null} [read] - reading permissions. 'null' for deletion (reset)
	 * @param {Array|Number|String|Null} [write] - writing permissions. 'null' for deletion (reset)
	 */
	setPermissions(read, write) {
		let diff = this.permissions.set(read, write);
		this.updateRooms(diff);
	}

	/**
	 * assign (or leave) client to/from rooms
	 * @param {Object} [diff] 
	 */
	updateRooms(diff) {
		if(this.isInitiated) {
			if(diff) {
				for(let permission of diff.read.removed) {
					this.socket.leave(`level_${permission}`);
				}
		
				for(let permission of diff.read.added) {
					this.socket.join(`level_${permission}`);
				}
			} else { //probably a just-initiated client so let's add him to rooms per existing permissions
				for(let permission of this.permissions.read) {
					this.socket.join(`level_${permission}`);
				}
			}
		}
	}

	/**
	 * prepare the object to send to the client by deleting the properties the client is unauthorized to view.
	 * semi-recursively iterates over the original plain object and clears unauthorized properties
	 * @param {Object} obj - an object/sub-object from the proxy
	 * @param {Object} permissionNode - a permissions map
	 */
	prepareObjectIterator(obj, permissionNode) {
		let typeofobj = realtypeof(obj);

		if(typeofobj === 'Object' || typeofobj === 'Array') { //they both behave the same
			let props = Object.keys(obj);
			for(let prop of props) {
				if(permissionNode[prop]) { //permissions for this property or sub-properties exists, so a validation is required
					if(this.permissions.verify(permissionNode[prop], 'read', false)) {
						this.prepareObjectIterator(obj[prop], permissionNode[prop]);
					} else {
						delete obj[prop];
					}
				}
			}
		}

		return obj; //it's a recursion but the only one expecting a return value is whoever called this
	}

	prepareObject(oh, path) {
		let permissionNode = oh.permissionTree.get(path, true);

		if(this.permissions.verify(permissionNode, 'read', false)) { //check if client even has permissions to access the root object
			let proxy = ohInstances.getProxy(oh);
			try {
				let { value } = Proxserve.evalPath(proxy, path);
				return this.prepareObjectIterator(cloneDeep(value), permissionNode);
			} catch(error) {
				console.error(error);
			}
		}

		return undefined;
	}

	init(oh) {
		this.isInitiated = true;
		oh.clients.set(this.id, this);

		let data = {
			obj: this.prepareObject(oh, ''),
			id: this.id
		};
		if(data.obj === undefined) data.obj = {};

		oh.io.to(this.socket.id).emit('init', data);

		this.updateRooms();
	}
};