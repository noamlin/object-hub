/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict"

var OH = (function() {
	//switch for debugging specific behaviors that are not harming or are fixed via one side (client or server)
	//those scripts are too important to delete but the debugging affects performance so it should stay shut down
	var OH_DEBUG = false;

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

	return class OH {
		constructor(domain, clientData, afterInitCallback) {
			this.domain = domain;
			this.id;
			this.delay = 9;
			this.initiated = false;
			this.serverUpdatesQueue = []; //the changes received from server
			this.ownUpdates = []; //the changes the client emits on his own
			
			this.socket = io(`/oh-${domain}`, {
				autoConnect: true,
				reconnection: true,
				query: { data: JSON.stringify(clientData) }
			});

			this.socket.on('init', (data) => { //gets initiated with data from the server
				this.id = data.id;
				if(data.obj) {
					this.object = new Proxserve(data.obj);
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

		updateObject(changes) {
			if(areValidChanges(changes)) {
				//all changes are queueq for 10 ms and then fired to all listeners. so we will flag to stop our next listener call
				//preventing infinite loop of emitting the changes we got from the server back to the server
				let now = Date.now();

				changesLoop: for(let change of changes) {
					if(OH_DEBUG) {
						for(let i = this.ownUpdates.length-1; i >= 0; i--) {
							let ownChange = this.ownUpdates[i][0];
			
							if(change.type === ownChange.type && change.path === ownChange.path) { //probably a change we triggered, sent to server and got back again
								if(change.type === 'delete' || change.value === ownChange.value) { //both are delete or both change to the same value
									this.ownUpdates.splice(i, 1); //matched so delete it immediately
									continue changesLoop; //skip this change because we are the ones initiated it
								}
							}
			
							if(now - this.ownUpdates[i][1] >= this.delay*2) {
								this.ownUpdates.splice(i, 1); //no need to re-check this own-update again
							}
						}
					}

					this.serverUpdatesQueue.push([change, now]); //save the change - value references might be altered later
					let parts = Proxserve.splitPath(change.path);
					let currObj = this.object;

					while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
						currObj = currObj[ parts.shift() ];
					}

					if(parts.length === 1) { //previous loop finished on time
						switch(change.type) {
							case 'create':
								if(OH_DEBUG) {
									if(typeof currObj[ parts[0] ] !== 'undefined') {
										console.warn('tried to create a new property but instead updated an existing one:');
										console.warn(change);
									}
								}
								currObj[ parts[0] ] = change.value; //value might be an object reference
								break;
							case 'update':
								currObj[ parts[0] ] = change.value; //value might be an object reference
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

		onObjectChange(changes) {
			let now = Date.now();
			//shallow copy in order to to change the reference of changes which is also used by client's listeners
			let clientChanges = changes.slice(0);

			for(let i = this.serverUpdatesQueue.length-1; i >= 0; i--) {
				let serverChange = this.serverUpdatesQueue[i][0];

				for(let j = clientChanges.length-1; j >= 0; j--) {
					let change = clientChanges[j];
					let value;
					try {
						value = change.value.$getOriginalTarget(); //in case it was proxied
					} catch(err) {
						value = change.value; //just a primitive
					}
					
					if(change.type === serverChange.type && change.path === serverChange.path //probably the same change
						&& (change.type === 'delete' || value === serverChange.value)) { //both are delete or both change to the same value
							clientChanges.splice(j, 1); //no need to send this change to the server
							this.serverUpdatesQueue[i][1] = 0; //will get it deleted
							break;
					}
				}

				if(now - this.serverUpdatesQueue[i][1] >= this.delay*2) {
					this.serverUpdatesQueue.splice(i, 1); //no need to re-check this server-update again
				}
			}

			if(clientChanges.length >= 1) {
				if(OH_DEBUG) {
					for(let change of clientChanges) {
						this.ownUpdates.push([change, now]);
					}
				}
				this.socket.emit('change', clientChanges);
			}
		}
	};
})();