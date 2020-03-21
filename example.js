"use strict"

const http = require('http');
const express = require('express');
const app = express();
const Oh = require('./oh.js');

const server = http.Server(app);
server.listen(1337);

var ohMain = new Oh('main', server);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/example.html');
});
app.get('/observable-slim.js', (req, res) => {
	res.sendFile(__dirname + '/node_modules/observable-slim/observable-slim.js');
});