"use strict"

class Oh {
	constructor(rootPath) {
		this.rootPath = rootPath;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true
		});

		this.socket.on('create', (obj) => {
			this[this.rootPath] = ObservableSlim.create(obj, true, (changes) => {
				//
			});
		});

		this.socket.on('objectChange', (changes) => {
			console.log(changes);
		});
	}
};