"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const ObservableSlim = require('observable-slim');

function normalizeId(id) {
	let acceptableChars = {
		signs: {$:1, _:1},
		digits: {'1':1,'2':1,'3':1,'4':1,'5':1,'6':1,'7':1,'8':1,'9':1},
		lowercase: {a:1,b:1,c:1,d:1,e:1,f:1,g:1,h:1,i:1,j:1,k:1,l:1,m:1,n:1,o:1,p:1,q:1,r:1,s:1,t:1,u:1,v:1,w:1,x:1,y:1,z:1},
		uppercase: {A:1,B:1,C:1,D:1,E:1,F:1,G:1,H:1,I:1,J:1,K:1,L:1,M:1,N:1,O:1,P:1,Q:1,R:1,S:1,T:1,U:1,V:1,W:1,X:1,Y:1,Z:1}
	};

	let normalized = '';

	for(let i=0; i<id.length; i++) {
		if(id[i] in acceptableChars.signs || id[i] in acceptableChars.digits || id[i] in acceptableChars.lowercase || id[i] in acceptableChars.uppercase) {
			normalized += id[i];
		}
	}

	if(normalized.length === 0 || normalized[0] in acceptableChars.digits) {
		normalized = '_' + normalized;
	}

	return normalized;
}

function handleNewConnection(socket) {
	socket.OH = { id: normalizeId(socket.id) };
	this.clients[socket.OH.id] = socket;
	console.log(`socket.io user connected [ID: ${socket.id}]`);
	this.emit('connection', socket);
	this.io.to(socket.id).emit('create', this.obj);
}

function handleDisconnection(socket, reason) {
	delete this.clients[socket.OH.id];
	console.log(`socket.io user disconnected [ID: ${socket.id}]`);
	this.emit('disconnection', socket);
}

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, objBase = {}) {
		super();

		this.clients = {};
		this.io = socketio(server).of(`/object-hub/${rootPath}`);

		this.io.on('connection', (socket) => {
			handleNewConnection.call(this, socket);
		
			socket.on(rootPath, (data) => {
				//
			});
			
			socket.on('disconnect', handleDisconnection.bind(this, socket));
		});

		this.obj = ObservableSlim.create(objBase, true, function(changes) {
			/*
			currentPath:"players.undefined"
			jsonPointer:"/players/undefined"
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