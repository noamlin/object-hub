"use strict";

const { cloneDeep } = require('lodash');
const ohInstances = require('../oh/instances.js');
const { ClientPermissions } = require('../permissions/permissions.js');
const { defaultBasePermission } = require('../../utils/globals.js');
const { str2VarName, realtypeof } = require('../../utils/variables.js');

module.exports = exports = class Client {
	constructor(socket) {
		this.id = str2VarName(socket.id);
		this.isInitiated = false;
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

		if(this.isInitiated) {
			for(let permission of diff.read.removed) {
				this.socket.leave(`level_${permission}`);
			}
	
			for(let permission of diff.read.added) {
				this.socket.join(`level_${permission}`);
			}
		}
	}

	/**
	 * prepare the object to send to the client by deleting the properties the client is unauthorized to view.
	 * semi-recursively iterates over the original plain object and clears unauthorized properties
	 * @param {Object} obj - an object/sub-object from the proxy
	 * @param {Object} permissionNode - a permissions map
	 */
	prepareObject(obj, permissionNode) {
		let typeofobj = realtypeof(obj);

		if(typeofobj === 'Object' || typeofobj === 'Array') { //they both behave the same
			let props = Object.keys(obj);
			for(let prop of props) {
				if(permissionNode[prop]) { //permissions for this property or sub-properties exists, so a validation is required
					if(this.permissions.verify(permissionNode[prop], 'read', false)) {
						this.prepareObject(obj[prop], permissionNode[prop]);
					} else {
						delete obj[prop];
					}
				}
			}
		}

		return obj; //it's a recursion but the only one expecting a return value is whoever called this
	}

	init(oh) {
		let proxy = ohInstances.getProxy(oh);

		let data = {
			obj: {},
			id: this.id
		};

		if(this.permissions.verify(oh.permissionTree, 'read', false)) { //check if client even has permissions to access the root object
			data.obj = this.prepareObject(cloneDeep(proxy), oh.permissionTree); //TODO - RETURNS UNDEFINED OBJECT <<===========================
		}

		oh.io.to(this.socket.id).emit('init', data);
	}
};