"use strict"

const http = require('http');
const express = require('express');
const app = express();
const Oh = require('./index.js');
const { isNumeric } = require('./utils/general.js');

const server = http.createServer(app);
server.listen(1337);

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/example.html');
});
app.get('/client/oh.js', (req, res) => {
	res.sendFile(__dirname + '/client/oh.js');
});
app.get('/proxserve.js', (req, res) => {
	res.sendFile('/var/www/proxserve/index.js', { root: '/' });
});

let infrastructure = {
	players: {},
	table: {
		flop: [], turn: 0, river: 0
	},
	test: {
		sub: {
			secret: 'first can see',
			secret2: 'second can see',
			secret3: 'all privileged can see'
		}
	},
	someObj: {
		someArray: [1, 2, {topSecret: 'a'}, 3, 4, {topSecret: 'b'}]
	}
};

var ohMain = new Oh('game', server, infrastructure);

ohMain.setPermission('game', 0, 0);
ohMain.setPermission('game.test', 1, [1,2,3]);
ohMain.setPermission('game.test.sub', 1, [2,3]);
ohMain.setPermission('game.test.sub.secret2', 1, 2);
ohMain.setPermission('game.test.sub.secret3', 1, 3);
ohMain.setPermission('game.someObj.someArray', 0, [1,2]);
ohMain.setPermission('game.someObj.someArray.#.topSecret', 0, 2);
ohMain.setPermission('game.does.not.exist', 4);

ohMain.on('connection', function(socket, clientData, init) {
	let id = socket.OH.id;
	this.setPermission(`game.players.${id}.secret`, id, id);

	this.game.players[id] = {
		name: '',
		age: 0,
		secret: Math.floor(Math.random()*10000)
	};

	if(isNumeric(clientData.level)) {
		let clientLevel = parseInt(clientData.level);
		this.setClientPermissions(socket, clientLevel, clientLevel);
	}

	init();
});
ohMain.on('disconnection', function(socket, reason) {
	delete this.game.players[socket.OH.id];
});

var loopCount = 0;
setInterval(() => {
	switch(loopCount) {
		case 0:
			switch(ohMain.game.someObj.someArray[2].topSecret) {
				case 'a': ohMain.game.someObj.someArray[2].topSecret = 'b'; break;
				case 'b': ohMain.game.someObj.someArray[2].topSecret = 'c'; break;
				default: ohMain.game.someObj.someArray[2].topSecret = 'a';
			}
			break;
		case 1:
			if(Number.isInteger(ohMain.game.table.river)) {
				if(ohMain.game.table.river === 0) ohMain.game.table.river = 1;
				else if(ohMain.game.table.river === 1) delete ohMain.game.table.river;
			} else {
				ohMain.game.table.river = 0;
			}
			break;
		case 2:
			if(ohMain.game.exist) {
				delete ohMain.game.exist;
			} else {
				ohMain.game.exist = { inner1: { inner2: true } };
			}
			break;
		case 3:
			if(ohMain.game.test.sub.secret3 === 'all privileged can see') ohMain.game.test.sub.secret3 = 'all privileged got an update';
			else ohMain.game.test.sub.secret3 = 'all privileged can see';
			break;
	}
	
	loopCount++;
	if(loopCount > 3) loopCount = 0;
}, 500);