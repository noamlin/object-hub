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
app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client-side/oh.js`); });
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
ohMain.setPermissions('game.test', [1,2,3], 1);
ohMain.setPermissions('game.test.sub', [2,3], 2);
ohMain.setPermissions('game.test.sub.secret', 5);
ohMain.setPermissions('game.test.sub.secret2', 2, 1);
ohMain.setPermissions('game.test.sub.secret3', 3, 1);
ohMain.setPermissions('game.someObj.someArray', [1,2], 0);
ohMain.setPermissions('game.someObj.someArray[0-5].topSecret', 2, 0);
ohMain.setPermissions('game.table.flop[1]', 3, 3);
ohMain.setPermissions('game.does.not.exist', 4);

ohMain.on('connection', function(client, clientData, init) {
	let id = client.id;
	this.setPermissions(`game.players.${id}.secret`, id, id); //only client himself can read/write this secret
	
	let clientLevel = 0;
	if(isNumeric(clientData.level)) {
		clientLevel = parseInt(clientData.level);
	}

	let names = ['John','Oliver','Mike','Larry','Austin'];

	this.game.players[id] = {
		name: names[clientLevel],
		age: 0,
		secret: Math.floor(Math.random()*10000)
	};

	let RWpermissions = clientLevel;
	if(clientLevel % 2 === 0) {
		RWpermissions = [clientLevel, 5];
	}
	client.setPermissions(RWpermissions, RWpermissions);

	init();
});
ohMain.on('disconnection', function(client, reason) {
	console.log(`deleting client from list because of: ${reason}`);
	delete this.game.players[client.id];
});
ohMain.on('client-change', function(changes, client, commitClientChanges) {
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

		this.game.last_changer = client.id;
	} else {
		commitClientChanges();
	}
});

var loopCount = 0;
var secret;
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
			secret = (secret === 'can see') ? 'got and update' : 'can see';
			ohMain.game.test.sub.secret = `[1,2,3] & [2,3] ${secret}`;
			ohMain.game.test.sub.secret3 = `all privileged ${secret}`;
			break;
	}
	
	loopCount++;
	if(loopCount > 3) loopCount = 0;
}, 500);