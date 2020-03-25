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
	players: [],
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
	'main': { writeAuth: [0] },
	'main.players[].money': { writeAuth: [1] },
	'main.test.sub.secret': { writeAuth: [2] }
};

var ohMain = new Oh('main', server, infrastructure, permissionsMap);
ohMain.on('connection', function(socket) {
	this.obj.players[socket.OH.id] = socket.id;
});
ohMain.on('disconnection', function(socket) {
	delete this.obj.players[socket.OH.id];
});