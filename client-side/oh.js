"use strict"

var OH = (function() {
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
			this.serverUpdatesQueue = [];
			
			this.socket = io(`/oh-${domain}`, {
				autoConnect: true,
				query: { data: JSON.stringify(clientData) },
				reconnection: false
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

				for(let change of changes) {
					this.serverUpdatesQueue.push([change, now]); //save the change - value references might be altered later
					let parts = Proxserve.splitPath(change.path);
					let currObj = this.object;

					while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
						currObj = currObj[ parts.shift() ];
					}

					if(parts.length === 1) { //previous loop finished on time
						switch(change.type) {
							case 'create':
								if(typeof currObj[ parts[0] ] !== 'undefined') {
									console.warn('tried to create a new property but instead updated an existing one:');
									console.warn(change);
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

					if(typeof change.reason === 'string') {
						console.warn(change.path, change.reason);
					}
				}
			} else {
				console.error('changes received from server are not valid', changes);
			}
		}

		onObjectChange(changes) {
			let now = Date.now();

			for(let i = this.serverUpdatesQueue.length-1; i >= 0; i--) {
				let serverChange = this.serverUpdatesQueue[i][0];

				for(let j = changes.length-1; j >= 0; j--) {
					let change = changes[j];
					
					if(change.type === serverChange.type && change.path === serverChange.path) { //probably the same change
						if(change.type === 'delete' || change.value === serverChange.value) { //both are delete or both change to the same value
							changes.splice(j, 1); //no need to send this change to the server
							this.serverUpdatesQueue[i][1] = 0; //will get it deleted
							break;
						}
					}
				}

				if(now - this.serverUpdatesQueue[i][1] >= this.delay*2) {
					this.serverUpdatesQueue.splice(i, 1); //no need to re-check this server-update again
				}
			}

			if(changes.length >= 1) {
				//this.socket.emit('change', changes);
			}
		}
	};
})();