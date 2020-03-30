"use strict"

const { cloneDeep } = require('lodash');
const { realtypeof } = require('../../utils/general.js');

/**
 * prepare the object to send to the client by deleting the properties the client is unauthorized to view
 * @param {Object} obj 
 * @param {Object} permissions 
 * @param {Number} clientReadPermissions
 */
function prepareObjectForClient(clientReadPermissions) {
	let obj = {};
	obj[this._rootPath] = cloneDeep(this[this._rootPath].__getTarget);
	delete obj[this._rootPath].__getTarget;

	iterateClear(obj, '', this._permissions, clientReadPermissions);
	return obj;
}

/**
 * semi recursively iterates over the original plain object and clears unauthorized properties
 * @param {Object} obj - the original object OR sub-objects
 * @param {String} path - current path in the original object
 * @param {Object} permissions - a permissions map
 * @param {Object} clientReadPermissions - the client's authorization map
 */
function iterateClear(obj, path, permissions, clientReadPermissions) {
	let props = Object.keys(obj);
	for(let prop of props) {
		let currPath;
		if(path === '') currPath = prop;
		else currPath = `${path}.${prop}`;

		/** if we've hit a path that requires permission */
		if(permissions[currPath]) {
			let clientHasPermission = false;
			let reads = Object.keys(permissions[currPath].reads);
			for(let read of reads) {
				if(read === 0 || read === '0') {
					clientHasPermission = true;
					break;
				}

				if(clientReadPermissions[ read ]) { //client has the permission for this category
					clientHasPermission = true;
				}
			}

			if(!clientHasPermission) {
				delete obj[prop];
			}
		}

		/** handle the recursion */
		let type_of = realtypeof(obj[prop]);
		if(type_of === 'Object') {
			iterateClear(obj[prop], currPath, permissions, clientReadPermissions);
		}
		else if(type_of === 'Array') {
			for(let i=0; i < obj[prop].length; i++) {
				if(realtypeof(obj[prop][i]) === 'Object') {
					iterateClear(obj[prop][i], `${currPath}.#`, permissions, clientReadPermissions);
				}
			}
		}
	}
}

module.exports = exports = {
	prepareObjectForClient: prepareObjectForClient
};