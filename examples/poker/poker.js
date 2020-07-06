"use strict"

const path = require('path');
const baseDir = path.resolve(__dirname, '../../');
const http = require('http');
const express = require('express');
const app = express();
const OH = require(`${baseDir}/index.js`);
const { cloneDeep } = require('lodash');

const server = http.createServer(app);
server.listen(1337);

app.get('/', (req, res) => { res.sendFile(`${baseDir}/examples/poker/index.html`); });
app.get(/\/game\d*.html/, (req, res) => { res.sendFile(`${baseDir}/examples/poker/game.html`); });
app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client-side/oh.js`); });
app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/index.js`); });
app.use('/public-files', express.static(`${baseDir}/examples/poker/public-files`));

var poker = new OH('poker', server, {});
var pokerInstance = OH.getInstance(poker);

pokerInstance.setPermissions('cards', 'no_one', 'admin');

pokerInstance.on('connection', function(client, clientData, init) {
	if(this.clients.size === 0) {
		initiateGame();
	}
	else if(this.clients.size > 8) {
		return; //don't connect more than 8 players
	}

	let id = client.id;
	let playerIndex = poker.players.length; //future to be

	this.setPermissions(`poker.players[${playerIndex}]`, 0, id); //only client himself can write to this
	this.setPermissions(`poker.players[${playerIndex}].personal`, id, id); //only client himself can read & write to this

	poker.players.push({
		name: clientData.nickname,
		chips: 1000,
		personal: {
			id: id,
			cards: []
		}
	});

	init();
});
pokerInstance.on('disconnection', function(client, reason) {
	let id = client.id;
	for(let i=0; i < poker.players.length; i++) {
		if(poker.players[i] && poker.players[i].personal.id === id) {
			poker.players[i] = null;
			//poker.players.splice(i, 1);
			break;
		}
	}
	if(this.clients.size === 0) {
		initiateGame();
	}
});

var cardTypes = ['clubs','diamonds','hearts','spades'];
var cardNumbers = ['ace',2,3,4,5,6,7,8,9,10,'jack','queen','king'];
var cards = [];
for(let type of cardTypes) {
	for(let num of cardNumbers) {
		cards.push({ type: type, number: num, available: true });
	}
}

function initiateGame() {
	poker.players = [];
	poker.table = {
		flop: [0, 0, 0], turn: 0, river: 0
	};
	poker.cards = cloneDeep(cards);
	poker.status = 'round-end';
	poker.activePlayer = '';
}