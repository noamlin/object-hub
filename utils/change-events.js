/**
 * utilities for change-events
 */
"use strict";

const { realtypeof } = require('./variables.js');
const { forceEventChangeKey } = require('../utils/globals.js');
const ohInstances = require('../classes/oh/instances.js');

var validChangeTypes = ['create','update','delete'];

/**
 * check if received changes is a valid array of changes
 * @param {Array.<Change>} changes 
 */
function areValidChanges(changes) {
	if(!Array.isArray(changes) || changes.length === 0) {
		return false;
	}

	for(let change of changes) {
		if(typeof change.path !== 'string'
		|| !validChangeTypes.includes(change.type)
		|| (!change.hasOwnProperty('value') && change.type !== 'delete') /*create and update must have a 'value' property*/
		|| (!change.hasOwnProperty('oldValue') && change.type === 'update')) {/*update must have an 'oldValue' property*/
			return false;
		}
	}

	return true;
}

/**
 * the change object as emitted from Proxserve
 * @typedef {Object} Change - each change emitted from Proxserve
 * @property {String} path - the path from the object listening to the property that changed
 * @property {*} value - the new value that was set
 * @property {*} oldValue - the previous value
 * @property {String} type - the type of change. may be - "create"|"update"|"delete"
 */
/**
 * analyzes the changes before traversing them:
 * - extracting system reserved properties
 * - spreads an array of event-changes to a more verbose array of changes by transforming the
 *   creation of objects or arrays into individual changes of each property.
 * - comparing all possible permissions
 * @param {Array.<Change>} changes
 * @param {Object} oh
 * @param {Object} type - whether to compare required permissions of 'read' or 'write'
 * @param {Object} [digested] - already digested parts
 */
function digest(changes, oh, type, digested) {
	if(!areValidChanges(changes)) {
		throw new Error('Invalid changes were given');
	}

	let isFirstIteration = false;

	if(typeof digested === 'undefined') { //happens only on the first iteration of the recursion
		isFirstIteration = true;
		
		digested = {
			filteredChanges: [],
			spreadedChanges: [],
			permission: oh.permissionTree.get(changes[0].path),
			requiresDifferentPermissions: false
		};
	}

	for(let i = 0; i < changes.length; i++) {
		let change = changes[i];

		if(isFirstIteration) {
			if(change.path === `.${forceEventChangeKey}`) {
				if(change.type !== 'delete') {
					let proxy = ohInstances.getProxy(oh);
					delete proxy[forceEventChangeKey];
				}
				continue;
			}
			else {
				digested.filteredChanges.push(change);
			}
		}
		
		//check if permission is different between changes. inner changes will be check during the recursion
		if(digested.requiresDifferentPermissions === false) {
			let currentPermission = oh.permissionTree.get(change.path);
			if(oh.permissionTree.compare(digested.permission, currentPermission, type) === false) {
				digested.requiresDifferentPermissions = true;
			}
		}

		let typeofchange = realtypeof(change.value);

		if((change.type === 'create' || change.type === 'update') && typeofchange === 'Object') {
			digested.spreadedChanges.push({ path: change.path, type: change.type, oldValue: change.oldValue, value: {} }); //shallow change

			let innerChanges = [];
			let keys = Object.keys(change.value);
			for(let key of keys) {
				innerChanges.push({ path: `${change.path}.${key}`, type: 'create', oldValue: undefined, value: change.value[key] });
			}
			
			if(innerChanges.length > 0) {
				digest(innerChanges, oh, type, digested);
			}
		}
		else if((change.type === 'create' || change.type === 'update') && typeofchange === 'Array') {
			digested.spreadedChanges.push({ path: change.path, type: change.type, oldValue: change.oldValue, value: [] }); //shallow change
			let innerChanges = [];
			for(let i=0; i < change.value.length; i++) {
				innerChanges.push({ path: `${change.path}[${i}]`, type: 'create', oldValue: undefined, value: change.value[i] });
			}

			if(innerChanges.length > 0) {
				digest(innerChanges, oh, type, digested);
			}
		}
		else {
			digested.spreadedChanges.push(change);
		}
	}

	return digested;
}

module.exports = exports = {
	areValidChanges: areValidChanges,
	digest: digest
};