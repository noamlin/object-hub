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
	 * match changes list against a secondary changes list and returns only the unique changes of the primary list
	 * @param {Array.<Change>} changes
	 * @param {Array.<Change>} matchAgainst
	 */
	function xorChanges(changes, matchAgainst) {
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

	return class OH {
		constructor(domain, afterInitCallback, clientData = {}, proxserveOptions = {}) {
			this.domain = domain;
			this.id;
			this.initiated = false;
			this.changesQueue = {
				client: [], /*the changes made by the client*/
				server: [] /*the changes received from the server*/
			};

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
				//prevent infinite loop of:
				//client changes & notify server -> server changes & notify client -> client changes again & notify again..
				let uniqueChanges = xorChanges(changes, this.changesQueue.client);
				this.changesQueue.client = []; //check against client-made-changes should happen for only one cycle
				for(let change of uniqueChanges) {
					this.changesQueue.server.push(change); //save the change - value references might be altered later
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
				};
			} else {
				console.error('changes received from server are not valid', changes);
			}
		}

		/**
		 * changes made by the client
		 * @param {Array.<Change>} changes 
		 */
		onObjectChange(changes) {
			//work on a copy of 'changes' in order not to change the reference of changes which is also used by client's listeners.
			//prevent infinite loop of:
			//server changes & notify client -> client changes & notify server -> server changes again & notify again..
			let uniqueChanges = xorChanges(changes, this.changesQueue.server);
			this.changesQueue.server = []; //check against server-changes should happen for only one cycle

			if(uniqueChanges.length >= 1) {
				this.changesQueue.client = this.changesQueue.client.concat(uniqueChanges);
				this.socket.emit('change', uniqueChanges);
			}
		}
	};
})();