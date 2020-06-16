/**
 * utilities for change-events
 */
"use strict";

const Proxserve = require('proxserve');
const { realtypeof } = require('./variables.js');
const { initsKey } = require('../utils/globals.js');

/**
 * evaluate a long path and return the designated object and its referred property
 * @param {Object} obj
 * @param {String} path
 */
function evalPath(obj, path) {
	let segments = Proxserve.splitPath(path);
	let i;
	for(i = 0; i <= segments.length - 2; i++) { //iterate until one before last property because they all must exist
		obj = obj[segments[i]];
		if(typeof obj === 'undefined') {
			throw new Error('Invalid path was given');
		}
	}
	return { object: obj, property: segments[i] };
}

var validChangeTypes = ['create','update','delete'];

function areValidChanges(changes) {
	if(!Array.isArray(changes) || changes.length === 0) {
		return false;
	}

	for(let change of changes) {
		if(typeof change.path !== 'string' ||
			!validChangeTypes.includes(change.type) ||
			(!change.hasOwnProperty('value') && change.type !== 'delete') ||
			(!change.hasOwnProperty('oldValue') && change.type !== 'create')) {
			return false;
		}
	}

	return true;
}

/**
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
 * @param {Array.Change} changes
 * @param {Object} permissionTree
 * @param {Object} [digested] - already digested parts
 */
function digest(changes, permissionTree, digested) {
	if(!areValidChanges(changes)) {
		throw new Error('Invalid changes were given');
	}

	let isFirstIteration = false; //is it the first run of this recursion

	if(typeof digested === 'undefined') {
		digested = {
			filteredChanges: [],/*original changes with special properties filtered out*/
			spreadedChanges: [],
			hasInits: false,
			permission: permissionTree.get(changes[0].path),
			requiresDifferentPermissions: false
		};
		isFirstIteration = true;
	}

	for(let i = 0; i < changes.length; i++) {
		let change = changes[i];
		let typeofchange = realtypeof(change.value);
		
		//check if permission is different between changes. inner changes will be check during the recursion
		if(digested.requiresDifferentPermissions === false) {
			let currentPermission = permissionTree.get(change.path);
			if(permissionTree.compare(digested.permission, currentPermission, 'read') === false) {
				digested.requiresDifferentPermissions = true;
			}
		}

		if(isFirstIteration) {
			if(change.path === `.${initsKey}`) {
				if(change.type !== 'delete') {
					digested.hasInits = true;
				}
				continue;
			} else {
				digested.filteredChanges.push(change);
			}
		}

		if((change.type === 'create' || change.type === 'update') && typeofchange === 'Object') {
			digested.spreadedChanges.push({ path: change.path, type: change.type, oldValue: change.oldValue, value: {} }); //shallow change

			let innerChanges = [];
			let keys = Object.keys(change.value);
			for(let key of keys) {
				innerChanges.push({ path: `${change.path}.${key}`, type: 'create', oldValue: undefined, value: change.value[key] });
			}
			
			if(innerChanges.length > 0) {
				digest(innerChanges, permissionTree, digested);
			}
		}
		else if((change.type === 'create' || change.type === 'update') && typeofchange === 'Array') {
			digested.spreadedChanges.push({ path: change.path, type: change.type, oldValue: change.oldValue, value: [] }); //shallow change
			let innerChanges = [];
			for(let i=0; i < change.value.length; i++) {
				innerChanges.push({ path: `${change.path}[${i}]`, type: 'create', oldValue: undefined, value: change.value[i] });
			}

			if(innerChanges.length > 0) {
				digest(innerChanges, permissionTree, digested);
			}
		}
		else {
			digested.spreadedChanges.push(change);
		}
	}

	return digested;
}

module.exports = exports = {
	splitPath: Proxserve.splitPath,
	evalPath: evalPath,
	areValidChanges: areValidChanges,
	digest: digest
};