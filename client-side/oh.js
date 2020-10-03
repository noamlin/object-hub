/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

var OH = (function() {
	/**
	 * the change object as emitted from Proxserve
	 * @typedef {Object} Change - each change emitted from Proxserve
	 * @property {String} path - the path from the object listening to the property that changed
	 * @property {*} value - the new value that was set
	 * @property {*} oldValue - the previous value
	 * @property {String} type - the type of change. may be - "create"|"update"|"delete"
	 */

	//switch for debugging specific behaviors that are not harming or are fixed via one side (client or server)
	//those scripts are too important to delete but the debugging affects performance so it should stay shut down
	let OH_DEBUG = false;

	let validChangeTypes = ['create','update','delete'];
	
	/**
	 * check if received changes is a valid array of changes
	 * @param {Array.<Change>} changes 
	 */
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

	function isObject(obj) {
		return (obj !== null && typeof obj === 'object');
	}
	function simpleDeepEqual(obj1, obj2) {
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
	 * match changes against another changes list that lives for a limited time
	 * and return only the unique changes
	 * @param {Array.<Change>} changes
	 * @param {Array.<{0: Change, 1: Number}>} matchAgainst
	 * @param {Number} ttl - time to live for the 'matchAgainst' changes
	 */
	function* xorChanges(changes, matchAgainst, ttl) {
		let now = Date.now();

		changesLoop: for(let i = 0; i < changes.length; i++) {
			let change = changes[i];

			let value;
			try {
				value = change.value.$getOriginalTarget(); //in case it was proxied
			} catch(err) {
				value = change.value; //just a primitive
			}

			for(let j = matchAgainst.length - 1; j >= 0; j--) {
				let againstChange = matchAgainst[j][0];

				if(now - matchAgainst[j][1] >= ttl) {
					matchAgainst.splice(j, 1); //this change is expired
				}
				
				if(change.type === againstChange.type && change.path === againstChange.path /*probably the same change*/
				&& (change.type === 'delete' || simpleDeepEqual(value, againstChange.value))) { //both are delete or both change to the same value
					matchAgainst.splice(j, 1); //matchAgainst change should match once
					continue changesLoop;
				}
			}

			yield change;
		}

		if(matchAgainst.length > 200) {
			console.warn(`matchAgainst list exceeded 200 changes!
This should not happen since matchAgainst is supposed to regularly get matched and cleaned up.
Client might be out of sync.
performing matchAgainst brute force cleanup`);
			//TODO - should we re-sync the client with the server's OH?
			for(let j = matchAgainst.length - 1; j >= 0; j--) {
				if(now - matchAgainst[j][1] >= ttl) {
					matchAgainst.splice(j, 1); //this change is expired
				}
			}
		}

		return;
	}

	return class OH {
		constructor(domain, afterInitCallback, clientData = {}, proxserveOptions = {}) {
			this.domain = domain;
			this.id;
			this.initiated = false;
			this.clientChangesQueue = []; //the changes made by the client
			this.serverChangesQueue = []; //the changes received from the server

			this.proxserveOptions = {
				delay: (proxserveOptions.delay !== undefined) ? proxserveOptions.delay : 10,
				strict: (proxserveOptions.strict !== undefined) ? proxserveOptions.strict : true,
				emitReference: (proxserveOptions.emitReference !== undefined) ? proxserveOptions.emitReference : false
			};
			
			this.socket = io(`/oh-${domain}`, {
				autoConnect: true,
				reconnection: true,
				query: { data: JSON.stringify(clientData) }
			});

			this.socket.on('init', (data) => { //gets initiated with data from the server
				this.id = data.id;
				if(data.obj) {
					this.object = new Proxserve(data.obj, this.proxserveOptions);
					this.object.on('change', this.onObjectChange.bind(this)); //when client alters the object
					this.initiated = true;
					if(afterInitCallback) {
						afterInitCallback(this.object);
					}
				}
			});

			this.socket.on('change', (changes) => {
				if(this.initiated) {
					this.updateObject(changes);
				}
			});
		}

		/**
		 * changes received from the server
		 * @param {Array.<Change>} changes 
		 */
		updateObject(changes) {
			if(areValidChanges(changes)) {
				//all changes are queueq for 10 ms and then fired to all listeners. so we will flag to stop our next listener call
				//preventing infinite loop of emitting the changes we got from the server back to the server
				let now = Date.now();

				let generateChange = xorChanges(changes, this.clientChangesQueue, 1000);
				let genYield;
				while((genYield = generateChange.next()).done !== true) {
					let change = genYield.value;
					this.serverChangesQueue.push([change, now]); //save the change - value references might be altered later
					let parts = Proxserve.splitPath(change.path);
					let currObj = this.object;

					while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
						currObj = currObj[ parts.shift() ];
					}

					if(parts.length === 1) { //previous loop finished on time
						switch(change.type) {
							case 'create':
							case 'update':
								if(OH_DEBUG && change.type === 'create' && typeof currObj[ parts[0] ] !== 'undefined') {
									console.warn('tried to create a new property but instead updated an existing one:');
									console.warn(change);
								}

								if(!simpleDeepEqual(currObj[ parts[0] ], change.value)) {
									//update only if values are completely different. this helps avoid double asigning of new objects.
									//for example - the client sets a new object {a:1}, then updates the server which in turn updates the
									//client which will see that the local {a:1} is not the same reference as the server's {a:1}
									if(typeof change.value !== 'object') {
										currObj[ parts[0] ] = change.value;
									} else {
										//don't point to original 'change.value' so later it will not get altered and then fail on 'xorChanges'
										currObj[ parts[0] ] = Proxserve.simpleClone(change.value);
									}
								}
								break;
							case 'delete':
								delete currObj[ parts[0] ];
								break;
						}
					} else {
						console.error('couldn\'t loop completely over path', change);
					}

					if(typeof change.reason === 'string' && change.reason.length >= 1) {
						console.warn(change.path, change.reason);
					}
				}
			} else {
				console.error('changes received from server are not valid', changes);
			}
		}

		/**
		 * changes made by the client
		 * @param {Array.<Change>} changes 
		 */
		onObjectChange(changes) {
			let now = Date.now();
			//shallow copy in order not to change the reference of changes which is also used by client's listeners
			let clientChanges = [];

			let generateChange = xorChanges(changes, this.serverChangesQueue, this.proxserveOptions.delay * 2);
			let genYield;
			while((genYield = generateChange.next()).done !== true) {
				let change = genYield.value;
				clientChanges.push(change);
				this.clientChangesQueue.push([change, now]);
			}

			if(clientChanges.length >= 1) {
				this.socket.emit('change', clientChanges);
			}
		}
	};
})();