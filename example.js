"use strict"

const http = require('http');
const express = require('express');
const app = express();
const Oh = require('./oh.js');

const server = http.Server(app);
server.listen(1337);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/example.html');
});
app.get('/observable-slim.js', (req, res) => {
	res.sendFile(__dirname + '/node_modules/observable-slim/observable-slim.js');
});
app.get('/oh.js', (req, res) => {
	res.sendFile(__dirname + '/oh-client.js');
});

let infrastructure = {
	players: {},
	tableCards: []
};
let permissionsMap = {
	'main': { read: [0], write: [0] },
	'main.players': { read: [0], write: [1] }
};

var ohMain = new Oh('main', server, infrastructure, permissionsMap);
ohMain.on('connection', function(socket) {
	this.obj.players[socket.OH.id] = socket.id;
});
ohMain.on('disconnection', function(socket) {
	delete this.obj.players[socket.OH.id];
});