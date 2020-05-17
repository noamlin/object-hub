"use strict";

const ohInstances = require('../oh/instances.js');
const { ClientPermissions, defaultBasePermission } = require('../permissions/permissions.js');
const { str2VarName, realtypeof } = require('../../utils/variables.js');
const { cloneDeep } = require('lodash');

module.exports = exports = class Client {
	constructor(socket) {
		this.id = str2VarName(socket.id);
		this.socket = socket;
		this.permissions = new ClientPermissions([defaultBasePermission, this.id]);
		this.setPermissions(); //initiates permissions with defaults
	}

	/**
	 * set client's reading & writing authorization level and assign him to rooms
	 * @param {Array|Number|String|Null} [read] - reading permissions. 'Null' for deletion
	 * @param {Array|Number|String|Null} [write] - writing permissions. 'Null' for deletion
	 */
	setPermissions(read, write) {
		let diff = this.permissions.set(read, write);

		for(let permission of diff.read.removed) {
			this.socket.leave(`level_${permission}`);
		}

		for(let permission of diff.read.added) {
			this.socket.join(`level_${permission}`);
		}
	}

	/**
	 * prepare the object to send to the client by deleting the properties the client is unauthorized to view
	 * @param {Object} oh - the OH instance
	 */
	prepareObject(oh) {
		let proxy = ohInstances.getProxy(oh);

		if(!this.permissions.verify(oh.permissionTree)) { //check if client even has permissions to access the root object
			return {};
		}
		else {
			let obj = cloneDeep(proxy);
			this.iterateClear(obj, oh.permissionTree);
			return obj;
		}
	}

	/**
	 * semi-recursively iterates over the original plain object and clears unauthorized properties
	 * @param {Object} obj - the original object OR sub-objects
	 * @param {Object} permissions - a permissions map
	 */
	iterateClear(obj, permissions) {
		let typeofobj = realtypeof(obj);

		if(typeofobj === 'Object' || typeofobj === 'Array') { //they both behave the same
			let props = Object.keys(obj);
			for(let prop of props) {
				if(permissions[prop]) { //permissions for this property or sub-properties exists, so a validation is required
					if(this.permissions.verify(permissions[prop])) {
						this.iterateClear(obj[prop], permissions[prop]);
					} else {
						delete obj[prop];
					}
				}
			}
		}
	}
};