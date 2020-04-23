"use strict"

const { cloneDeep, merge } = require('lodash');
const { realtypeof } = require('../../utils/general.js');

/**
 * prepare the object to send to the client by deleting the properties the client is unauthorized to view
 * @param {Object} obj 
 * @param {Object} permissions 
 * @param {Number} clientReadPermissions
 */
function prepareObjectForClient(clientReadPermissions) {
	let obj = {};
	obj[this.__rootPath] = cloneDeep(this[this.__rootPath]);

	iterateClear(obj, this.__permissions, clientReadPermissions);
	return obj;
}

/**
 * semi recursively iterates over the original plain object and clears unauthorized properties
 * @param {Object} obj - the original object OR sub-objects
 * @param {Object} permissions - a permissions map
 * @param {Object} clientReadPermissions - the client's authorization map
 */
function iterateClear(obj, permissions, clientReadPermissions) {
	let type_of = realtypeof(obj);

	if(type_of === 'Object' || type_of === 'Array') { //they both behave the same
		let props = Object.keys(obj);
		for(let prop of props) {
			if(permissions[prop]) { //permissions for this property or sub-properties exists, so a validation is required
				if(checkPermission(permissions[prop], clientReadPermissions)) {
					iterateClear(obj[prop], permissions[prop], clientReadPermissions);
				} else {
					delete obj[prop];
				}
			}
		}
	}
}

/**
 * check for path if client is permitted to read it
 * @param {Object} permissions
 * @param {Object} clientReadPermissions
 */
function checkPermission(permissions, clientReadPermissions) {
	if(typeof permissions === 'object' && permissions.__reads) {
		let reads = Object.keys(permissions.__reads);
		if(reads.length > 0) { //there is a permission required
			for(let read of reads) {
				if(read === 0 || read === '0') {
					continue;
				}
				else if(clientReadPermissions[ read ]) { //client has the permission for this category
					return true;
				}
			}
			return false; //we matched no permission
		}
	}

	return true;
}

module.exports = exports = {
	prepareObjectForClient: prepareObjectForClient
};