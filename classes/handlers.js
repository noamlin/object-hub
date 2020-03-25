"use strict"

const generalUtils = require('../utils/general.js');

/**
 * @param {Object} this - The OH class object
 */
module.exports = exports = {
	onConnection: function onConnection(socket) {
		socket.OH = {
			id: generalUtils.normalizeId(socket.id),
			writeAuth: 0
		};
		this.clients[socket.OH.id] = socket;
		console.log(`socket.io user connected [ID: ${socket.id}]`);
		this.emit('connection', socket);
		this.io.to(socket.id).emit('create', this.obj);
	},

	onDisconnection: function onDisconnection(socket, reason) {
		delete this.clients[socket.OH.id];
		console.log(`socket.io user disconnected [ID: ${socket.id}]`);
		this.emit('disconnection', socket);
	}
};