"use strict"

const http = require('http');
const express = require('express');
const app = express();
const Oh = require('./index.js');

const server = http.Server(app);
server.listen(1337);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/example.html');
});
app.get('/observable-slim.js', (req, res) => {
	res.sendFile(__dirname + '/node_modules/observable-slim/observable-slim.js');
});
app.get('/client/oh.js', (req, res) => {
	res.sendFile(__dirname + '/client/oh.js');
});

let infrastructure = {
	players: {},
	table: {
		flop: [], turn: 0, river: 0
	},
	test: {
		sub: {
			secret: 1
		}
	}
};
let permissionsMap = {
	'game': { read: 0, write: 0 },
	'game.test.sub.secret': { read: 1, write: 1 }
};

var ohMain = new Oh('game', server, infrastructure, permissionsMap);
ohMain.on('connection', function(socket, clientData) {
	let id = socket.OH.id;
	this.setPermission(`game.players.${id}.secret`, {read: id, write: id});

	this.game.players[id] = {
		name: '',
		age: 0,
		secret: Math.floor(Math.random()*10000)
	};

	if(!isNaN(clientData.fakeID)) {
		let fakeID = parseInt(clientData.fakeID);
		if(fakeID > 0) {
			socket.OH.setAuth(fakeID, fakeID);
		}
	}
});
ohMain.on('disconnection', function(socket) {
	delete this.game.players[socket.OH.id];
});

setInterval(() => {
	if(Number.isInteger(ohMain.game.table.river)) {
		if(ohMain.game.table.river === 0) ohMain.game.table.river = 1;
		else if(ohMain.game.table.river === 1) delete ohMain.game.table.river;
	} else {
		ohMain.game.table.river = 0;
	}

	ohMain.game.test.sub.secret++;

	if(ohMain.game.exist) {
		delete ohMain.game.exist;
	} else {
		ohMain.game.exist = true;
	}
}, 1000);