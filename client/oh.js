"use strict"

class Oh {
	constructor(rootPath, clientData) {
		this.__rootPath = rootPath;
		this.id;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true,
			query: clientData
		});

		this.socket.on('init', (data) => {
			console.log('init', data.reads, data.obj);
			this.id = data.id;
			/*if(data.obj && data.obj[this.__rootPath]) {
				this[this.__rootPath] = ObservableSlim.create(data.obj[this.__rootPath], true, (changes) => {
					//
				});
			}*/
		});

		this.socket.on('change', (changes) => {
			console.log(changes[0].type, changes);
		});
	}
};