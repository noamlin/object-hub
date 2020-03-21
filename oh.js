"use strict"

const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');

module.exports = exports = class Oh {
	constructor(rootPath, server) {
		this.io = socketio(server);

		this.io.on('connection', (socket) => {
			console.log(`socket.io user connected [ID: ${socket.id}]`);
		
			socket.on(`object-hub-${rootPath}`, (data) => {
				//
			});
			
			socket.on('disconnect', () => {
				console.log(`socket.io user disconnected [ID: ${socket.id}]`);
			});
		});
	}
};
/*
var test = {
	one: {
		two: {
			three: {
				four: {
					five: 6
				}
			}
		}
	}
};
var obj = ObservableSlim.create(test, true, function(changes) {
	for(let i=0; i<changes.length; i++) {
		delete changes[i].target;
		delete changes[i].proxy;
		delete changes[i].jsonPointer;
	}
	console.log(changes);
});

obj.one.two.three.four.five = 7;*/