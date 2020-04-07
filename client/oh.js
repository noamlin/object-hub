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
				this[this.__rootPath] = ObservableSlim.create(data.obj[this.__rootPath], true, this.onObjectChange.bind(this));
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
			ObservableSlim.stop(this[this.__rootPath]); //don't record these changes thinking the client made them

			for(let change of changes) {
				let parts = change.path.split('.');
				let currObj = this;

				while(typeof currObj[ parts[0] ] !== 'undefined' && parts.length > 1) {
					currObj = currObj[ parts.shift() ];
				}

				if(parts.length === 1) { //previous loop finished on time

					switch(change.type) {
						case 'add':
						case 'update':
							currObj[ parts[0] ] = change.newValue;
							break;
						case 'delete':
							delete currObj[ parts[0] ];
							break;
					}
				} else {
					console.error('couldn\'t loop completely over path', change);
				}
			}
			
			ObservableSlim.resume(this[this.__rootPath]);
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