"use strict"

class Oh {
	constructor(rootPath, clientData) {
		this._rootPath = rootPath;
		this.id;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true,
			query: clientData
		});

		this.socket.on('init', (data) => {
			console.log('init', data.reads, data.obj);
			this.id = data.id;
			/*if(data.obj && data.obj[this._rootPath]) {
				this[this._rootPath] = ObservableSlim.create(data.obj[this._rootPath], true, (changes) => {
					//
				});
			}*/
		});

		this.socket.on('change', (changes) => {
			console.log(changes[0].type, changes);
		});
	}
};