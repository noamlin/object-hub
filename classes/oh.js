"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');
const { onConnection, onDisconnection } = require('./handlers.js');

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, objBase = {}) {
		super();

		this.clients = {};
		this.io = socketio(server).of(`/object-hub/${rootPath}`);

		this.io.on('connection', (socket) => {
			onConnection.call(this, socket);
		
			socket.on(rootPath, (data) => {
				//
			});
			
			socket.on('disconnect', onDisconnection.bind(this, socket));
		});

		this.obj = ObservableSlim.create(objBase, true, function(changes) {
			/*
			currentPath:"players.abcd"
			jsonPointer:"/players/abcd"
			newValue:null
			previousValue:undefined
			property:"undefined"
			proxy:Proxy {objecthubWCXgnQL4_cWpkuRAAAA: "/object-hub#WCXgn0QL4_cWpkuRAAAA", objecthubQsyjL3olnYUXcjEJAAAB: "/object-hub#QsyjL3olnYUXcjEJAAAB", __targetPosition: 1}
			target:Object {objecthubWCXgnQL4_cWpkuRAAAA: "/object-hub#WCXgn0QL4_cWpkuRAAAA", objecthubQsyjL3olnYUXcjEJAAAB: "/object-hub#QsyjL3olnYUXcjEJAAAB", __targetPosition: 1}
			type:"delete"
			*/
			for(let i=0; i<changes.length; i++) {
				delete changes[i].target;
				delete changes[i].proxy;
				delete changes[i].jsonPointer;
			}
		});
	}
};