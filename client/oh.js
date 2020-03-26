"use strict"

class Oh {
	constructor(rootPath) {
		this.rootPath = rootPath;
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true
		});

		this.socket.on('init', (data) => {
			console.log(data);
			this[this.rootPath] = ObservableSlim.create(data.obj, true, (changes) => {
				//
			});
		});

		this.socket.on('objectChange', (changes) => {
			console.log(changes);
		});
	}
};