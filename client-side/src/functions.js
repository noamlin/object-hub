/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

var validChangeTypes = ['create','update','delete'];

/**
 * check if received changes is a valid array of changes
 * @param {Array.<Change>} changes 
 */
export function areValidChanges(changes) {
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

function isObject(obj) {
	return (obj !== null && typeof obj === 'object');
}

export function simpleDeepEqual(obj1, obj2) {
	if(obj1 === obj2) return true;

	if(!isObject(obj1) || !isObject(obj2)) return false;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) {
		return false;
	}

	for(let key of keys1) {
		let val1 = obj1[key];
		let val2 = obj2[key];

		if(!simpleDeepEqual(val1, val2)) {
			return false;
		}
	}
	
	return true;
}

/**
 * match changes list against a secondary changes list and returns only the unique changes of the primary list
 * @param {Array.<Change>} changes
 * @param {Array.<Change>} matchAgainst
 */
export function xorChanges(changes, matchAgainst) {
	let uniqueChanges = changes.slice();

	changesLoop: for(let i = 0; i < matchAgainst.length; i++) {
		let againstChange = matchAgainst[i];
		for(let j = uniqueChanges.length - 1; j >= 0; j--) {
			let change = uniqueChanges[j];
			if(change.type === againstChange.type && change.path === againstChange.path /*probably the same change*/
			&& (change.type === 'delete' || simpleDeepEqual(change.value, againstChange.value))) { //both are delete or both change to the same value
				uniqueChanges.splice(j, 1);
				continue changesLoop;
			}
		}
	}

	return uniqueChanges;
}