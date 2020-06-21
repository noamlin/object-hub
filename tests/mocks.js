"use strict";

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

class MockSocket {
	constructor() {
		this.id = 'id' + Math.floor(Math.random()*10000);
		this.handshake = { query: '' };
		MockSocket.rooms = {};
	}
	join(name) {
		if(!MockSocket.rooms[name]) {
			MockSocket.rooms[name] = {};
		}
		MockSocket.rooms[name][this.id] = true;
	}
	leave(name) {
		delete MockSocket.rooms[name][this.id];
	}
};
MockSocket.rooms = {};

var mockIO = {
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

module.exports = exports = {
	infrastructure: infrastructure,
	MockSocket: MockSocket,
	mockIO: mockIO
};