"use strict";

const { defaultBasePermission } = require('../utils/globals.js');
const { ClientPermissions } = require('../classes/permissions/permissions.js');

var infrastructure = {
	a_number: 1.23,
	a_string: 'some string',
	nested1: {
		nested2: {
			nested3: true
		},
		nested2_alt: [0, [0, 1, ['a']], 2]
	},
	an_arr: [
		0, 1,
		{ a:'a', b:'b', nestedArr: [{c:'c'}] },
		3, 4,
		{ a:'a', b:'b', nestedArr: [{c:'c'}] },
		6, 7
	]
};

var server = {
	_maxListeners: undefined,
	_unref: false,
	_usingWorkers: false,
	_workers: [],
	allowHalfOpen: true,
	connections: 0,
	headersTimeout: 40000,
	httpAllowHalfOpen: false,
	keepAliveTimeout: 5000,
	listening: true,
	maxHeadersCount: null,
	maxHeaderSize: undefined,
	pauseOnConnect:false
};

var io = {
	rooms: {},
	lastEmit: null,
	to: function(room) {
		this.rooms[room] = true;
		return this;
	},
	on: function(args) { console.log('on', args); },
	emit: function(message, data) {
		this.lastEmit = { to: this.rooms, message: message, changes: data };
		this.rooms = {};
	}
};

class Socket {
	constructor(id) {
		this.id = 'socket_' + id;
	}
	join(name) {
		if(!Socket.rooms[name]) {
			Socket.rooms[name] = {};
		}
		Socket.rooms[name][this.id] = true;
	}
	leave(name) {
		delete Socket.rooms[name][this.id];
	}
	disconnect(close) {
		Socket.disconnectCount++;
	}
}
Socket.rooms = {};
Socket.disconnectCount = 0;

class Client {
	constructor() {
		this.id = 'id' + Math.floor(Math.random()*10000);
		this.isInitiated = false;
		this.socket = new Socket(this.id);
		this.permissions = new ClientPermissions([defaultBasePermission, this.id]);
		this.permissions.set();
	}

	init(oh) {
		this.isInitiated = true;
		oh.clients.set(this.id, this);
	}

	setPermissions(read, write) {
		this.permissions.set(read, write);
	}
};

module.exports = exports = {
	infrastructure: infrastructure,
	server: server,
	io: io,
	Client: Client,
	Socket: Socket
};