/**
 * utilities for change-events
 */
"use strict";

const Proxserve = require('proxserve');
const { realtypeof } = require('./variables.js');

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

/**
 * spreads an array of event-changes to a more verbose array of changes.
 * creation of objects or arrays is transformed into individual changes of each property
 * @param {Array.Object} changes 
 */
function spread(changes) {
	let spreadedChanges = [];
	for(let i = 0; i < changes.length; i++) {
		let change = changes[i];
		let typeofchange = realtypeof(change.value);
		if(change.type === 'create' && typeofchange === 'Object') {
			spreadedChanges.push({ path: change.path, type: 'create', oldValue: undefined, value: {} }); //shallow change
			let innerChanges = [];
			let keys = Object.keys(change.value);
			for(let key of keys) {
				innerChanges.push({ path: `${change.path}.${key}`, type: 'create', oldValue: undefined, value: change.value[key] });
			}
			spreadedChanges = spreadedChanges.concat(spread(innerChanges));
		}
		else if(change.type === 'create' && typeofchange === 'Array') {
			spreadedChanges.push({ path: change.path, type: 'create', oldValue: undefined, value: [] }); //shallow change
			let innerChanges = [];
			for(let i=0; i < change.value.length; i++) {
				innerChanges.push({ path: `${change.path}[${i}]`, type: 'create', oldValue: undefined, value: change.value[i] });
			}
			spreadedChanges = spreadedChanges.concat(spread(innerChanges));
		}
		else {
			spreadedChanges.push(change);
		}
	}
	return spreadedChanges;
}

module.exports = exports = {
	splitPath: Proxserve.splitPath,
	evalPath: evalPath,
	spread: spread
};