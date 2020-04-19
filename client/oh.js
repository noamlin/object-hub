"use strict"

class Oh {
	constructor(rootPath, clientData) {
		this.__rootPath = rootPath;
		this.id;
		this.initiated = false;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true,
			query: clientData
		});

		this.socket.on('init', (data) => {
			this.id = data.id;
			if(data.obj && data.obj[this.__rootPath]) {
				this[this.__rootPath] = new Proxserve(data.obj[this.__rootPath]);
				this[this.__rootPath].on('change', this.onObjectChange.bind(this));
				this.initiated = true;
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
			this[this.__rootPath].stop(); //don't record these changes thinking the client made them

			for(let change of changes) {
				let parts = Proxserve.splitPath(change.path);
				let currObj = this;

				while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
					currObj = currObj[ parts.shift() ];
				}

				if(parts.length === 1) { //previous loop finished on time
					switch(change.type) {
						case 'add':
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
					console.warn(change.reason);
				}
			}
			
			this[this.__rootPath].activate();
		} else {
			console.error('changes received from server are not an array', changes);
		}
	}

	onObjectChange(changes) {
		for(let item of changes) {
			item.path = `${this.__rootPath}.${item.currentPath}`;
			delete item.currentPath;
			delete item.target;
			delete item.proxy;
			delete item.jsonPointer;
		}
	
		this.socket.emit('change', changes);
	}
};