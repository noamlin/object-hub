"use strict"

module.exports = exports = class Oh {
	constructor(rootPath) {
		this.socket = io();

		this.socket.on('stdout', (data) => {
			//
		});
	}
};