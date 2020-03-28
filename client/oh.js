"use strict"

class Oh {
	constructor(rootPath, clientData) {
		this._rootPath = rootPath;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true,
			query: clientData
		});

		this.socket.on('init', (data) => {
			console.log('init', data);
			if(data[this._rootPath]) {
				this[this._rootPath] = ObservableSlim.create(data[this._rootPath], true, (changes) => {
					//
				});
			}
		});

		this.socket.on('change', (changes) => {
			console.log(changes[0].type, changes);
		});
	}
};