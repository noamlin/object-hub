/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

import { simpleClone } from '../../node_modules/proxserve/general-functions.js';
import { areValidChanges, simpleDeepEqual, xorChanges } from './functions.js';

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

class OH {
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
									currObj[ parts[0] ] = simpleClone(change.value);
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

module.exports = exports = OH; //makes ParcelJS expose this globally (for all platforms) after bundling everything