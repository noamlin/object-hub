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



var cardTypes = ['clubs','diamonds','hearts','spades'];
var cardNumbers = ['ace',2,3,4,5,6,7,8,9,10,'jack','queen','king'];
var pokerDefaults = {
	players: [],
	cards: { available: [], dealt: [] },
	table: {
		flop: [0, 0, 0],
		turn: 0,
		river: 0
	}
};
for(let type of cardTypes) {
	for(let num of cardNumbers) {
		pokerDefaults.cards.available.push({ type: type, number: num });
	}
}

var poker = new OH('poker', server, cloneDeep(pokerDefaults));
var pokerInstance = OH.getInstance(poker);

pokerInstance.setPermissions('cards', 'no_one', 'no_one');

pokerInstance.on('connection', function(client, clientData, init) {
	client.nickname = clientData.nickname;
	console.log(`Client ${client.nickname} connected`);

	if(this.clients.size > 8) {
		return; //don't connect more than 8 players
	}

	let id = client.id;

	poker.players.push({
		id: id,
		name: clientData.nickname,
		chips: 1000,
		personal: {
			cards: []
		}
	});

	//important to update permissions immediately, before Proxserve's loop ends (10ms) and send the data to all clients
	updatePlayerPermissions(poker.players.length - 1);

	if(this.clients.size === 0 && this.pendingClients.size === 1) {
		resetGame();
	}

	init();
});
pokerInstance.on('disconnection', function(client, reason) {
	console.log(`Client ${client.nickname} disconnected`);

	let id = client.id;
	for(let i = poker.players.length-1; i >= 0; i--) {
		if(poker.players[i] && poker.players[i].id === id) {
			//will change places of cells and cause clients to create a whole new objects instead of replacing the existing ones
			poker.players.splice(i, 1);
			break;
		}
	}
	if(this.clients.size === 0) {
		resetGame();
	}
});

poker.players.on('change', (changes) => {
	for(let change of changes) {
		let {object, property} = OH.evalPath(poker.players, change.path);
		if(object === poker.players) {
			//after evaluation of the path we stayed on the same object so the path was to a direct property (index) of this array
			updatePlayerPermissions(property);
		}
	}
});

pokerInstance.on('client-change', function(changes, client, commitChange) {
	for(let change of changes) {
		if(change.path === '.status' && change.value === 'reset') {
			commitChange(change, false, ''); //disallow with no reason, because status will be changed by resetGame()
			resetGame();
		} else {
			commitChange(change); //allow change
		}
	}
});

function updatePlayerPermissions(index) {
	if(typeof poker.players[index] === 'object') { //the player wasn't deleted
		//only client himself can write:
		pokerInstance.setPermissions(`.players[${index}]`, 0, poker.players[index].id);
		//only client himself can read & write:
		pokerInstance.setPermissions(`.players[${index}].personal`, poker.players[index].id, poker.players[index].id);
	}
}

function resetGame() {
	poker.table = cloneDeep(pokerDefaults.table);
	poker.cards = cloneDeep(pokerDefaults.cards);

	if(poker.players.length > 1) {
		dealCards();
		poker.status = 'pre flop';
		poker.dealer = Math.floor(Math.random() * poker.players.length);
		poker.currentPlayer = (poker.dealer + 1 === poker.players.length) ? 0 : poker.dealer + 1;
	}
	else {
		poker.status = 'waiting for players';
		poker.dealer = 0;
		poker.currentPlayer = 0;
	}
}

function fetchCards(qty) {
	let cards = [];
	for(let i=0; i < qty; i++) {
		let rnd = Math.floor(Math.random() * poker.cards.available.length);
		let spliced = poker.cards.available.splice(rnd, 1);
		cards.push(...spliced);
	}
	poker.cards.dealt.push(...cards);
	return cards;
}

function dealCards() {
	for(let player of poker.players) {
		player.personal.cards = fetchCards(2);
	}
}