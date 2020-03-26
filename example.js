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
ohMain.on('connection', function(socket, activate) {
	this.setPermission(`game.players.${socket.OH.id}.secret`, {read: socket.OH.id, write: socket.OH.id});
	this.game.players[socket.OH.id] = {
		name: '',
		age: 0,
		secret: Math.floor(Math.random()*10000)
	};
	activate();
});
ohMain.on('disconnection', function(socket) {
	delete this.game.players[socket.OH.id];
});