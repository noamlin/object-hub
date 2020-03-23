"use strict"

class Oh {
	constructor(rootPath) {
		this.obj = {};
		
		this.socket = io(`/object-hub/${rootPath}`, {
			autoConnect: true
		});

		this.socket.on('create', (data) => {
			this.obj = data;
		});
	}
};