"use strict"

class OH {
	constructor(domain, clientData, afterInitCallback) {
		this.domain = domain;
		this.id;
		this.initiated = false;
		this.isServerUpdate = false;
		
		this.socket = io(`/oh-${domain}`, {
			autoConnect: true,
			query: { data: JSON.stringify(clientData) }
		});

		this.socket.on('init', (data) => { //gets initiated with data from the server
			this.id = data.id;
			if(data.obj) {
				this.object = new Proxserve(data.obj);
				this.object.on('change', (changes) => {
					this.onObjectChange(changes); //when client alters the object
				});
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
		if(Array.isArray(changes)) {
			//all changes are queueq for 10 ms and then fired to all listeners. so we will flag to stop our next listener call
			//preventing infinite loop of emitting the changes we got from the server back to the server
			this.isServerUpdate = true;

			for(let change of changes) {
				let parts = Proxserve.splitPath(change.path);
				let currObj = this.object;

				while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
					currObj = currObj[ parts.shift() ];
				}

				if(parts.length === 1) { //previous loop finished on time
					switch(change.type) {
						case 'create':
						case 'update':
							currObj[ parts[0] ] = change.value;
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
			console.error('changes received from server are not an array', changes);
		}
	}

	onObjectChange(changes) {
		if(this.isServerUpdate) {
			this.isServerUpdate = false;
			return;
		}
		if(changes.length === 0) {
			return;
		}

		this.socket.emit('change', changes);
	}
};