"use strict"

class OH {
	constructor(rootPath, clientData, afterInitCallback) {
		this.__rootPath = rootPath;
		this.id;
		this.initiated = false;
		this.isServerUpdate = false;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true,
			query: { data: JSON.stringify(clientData) }
		});

		this.socket.on('init', (data) => { //gets initiated with data from the server
			this.id = data.id;
			if(data.obj && data.obj[this.__rootPath]) {
				this[this.__rootPath] = new Proxserve(data.obj[this.__rootPath]);
				this[this.__rootPath].on('change', this.onObjectChange.bind(this)); //when client alters the object
				this.initiated = true;
				if(afterInitCallback) {
					afterInitCallback();
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
			//preventing infinite loop of emitting the changes from server back to the server
			this.isServerUpdate = true;

			for(let change of changes) {
				let parts = Proxserve.splitPath(change.path);
				let currObj = this;

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

		for(let i=0; i < changes.length; i++) {
			changes[i].path = `${this.__rootPath}${changes[i].path}`;
		}
		this.socket.emit('change', changes);
	}
};