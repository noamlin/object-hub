"use strict"

const path = require('path');
const baseDir = path.resolve(__dirname, '../../');
const http = require('http');
const express = require('express');
const app = express();
const OH = require(`${baseDir}/index.js`);
const { isNumeric } = require(`${baseDir}/utils/general.js`);

const server = http.createServer(app);
server.listen(1337);

app.get('/', (req, res) => { res.sendFile(`${baseDir}/examples/general/index.html`); });
app.get('/styles.css', (req, res) => { res.sendFile(`${baseDir}/examples/general/styles.css`); });
app.get('/scripts.js', (req, res) => { res.sendFile(`${baseDir}/examples/general/client-scripts.js`); });
app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client/oh.js`); });
app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/index.js`); });

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

var ohMain = new OH('game', server, infrastructure);

ohMain.setPermissions('game', 0, 0);
ohMain.setPermissions('game.test', 1, [1,2,3]);
ohMain.setPermissions('game.test.sub', 2, [2,3]);
ohMain.setPermissions('game.test.sub.secret2', 1, 2);
ohMain.setPermissions('game.test.sub.secret3', 1, 3);
ohMain.setPermissions('game.someObj.someArray', 0, [1,2]);
ohMain.setPermissions('game.someObj.someArray[0-5].topSecret', 0, 2);
ohMain.setPermissions('game.table.flop[1]', 3, 3);
ohMain.setPermissions('game.does.not.exist', 4);

ohMain.on('connection', function(socket, clientData, init) {
	let id = socket.OH.id;
	this.setPermissions(`game.players.${id}.secret`, id, id); //only client himself can read/write this secret

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
	console.log(`deleting player from game because of: ${reason}`);
	delete this.game.players[socket.OH.id];
});
ohMain.on('client-change', function(changes, socket, commitClientChanges) {
	let {object, property} = OH.evalPath(this, changes[0].path);

	if(object === this.game && ['foo','bar'].includes(property)) {
		//switch between 'foo' and 'bar', and also print who commited the change
		commitClientChanges(false);

		if(property === 'foo') {
			property = 'bar';
		}
		else {
			property = 'foo';
		}
		
		switch(changes[0].type) {
			case 'create':
			case 'update':
				object[property] = changes[0].value;
				break;
			case 'delete':
				delete object[property];
				break;
		}

		this.game.last_changer = socket.OH.id;
	} else {
		commitClientChanges();
	}
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