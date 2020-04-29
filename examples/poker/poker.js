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

app.use('/public-files', express.static(`${baseDir}/examples/poker/public-files`));

app.get('/', (req, res) => { res.sendFile(`${baseDir}/examples/poker/index.html`); });
app.get('/game.html', (req, res) => { res.sendFile(`${baseDir}/examples/poker/game.html`); });
app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client/oh.js`); });
app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/index.js`); });

var game = new OH('poker', server, {});

game.setPermissions('poker.cards', 'no_one', 'admin');

game.on('connection', function(socket, clientData, init) {
	if(this.clients.size === 1) {
		initiateGame();
	}
	else if(this.clients.size > 8) {
		return; //don't connect more than 8 players
	}

	let id = socket.OH.id;

	this.poker.players.push({
		id: id,
		name: clientData.nickname,
		chips: 1000,
		personal: {
			cards: [],
			auth: 'normal'
		}
	});
	let insertedID = this.poker.players.length - 1;

	this.setPermissions(`poker.players[${insertedID}]`, id); //only client himself can write to this
	this.setPermissions(`poker.players[${insertedID}].personal`, id, id); //only client himself can read & write to this

	if(this.clients.size === 1) {
		this.setClientPermissions(socket, 'admin', 'admin'); //first client to log-in will become admin
		this.poker.players[ this.poker.players.length-1 ].personal.auth = 'admin';
	}

	init();
});
game.on('disconnection', function(socket, reason) {
	let id = socket.OH.id;
	for(let i=0; i < this.poker.players.length; i++) {
		if(this.poker.players[i] && this.poker.players[i].id === id) {
			this.poker.players[i] = null;
			//this.poker.players.splice(i, 1);
			break;
		}
	}
	if(this.clients.size === 0) {
		initiateGame();
	}
});

function initiateGame() {
	game.poker.players = [];
	game.poker.table = {
		flop: [0, 0, 0], turn: 0, river: 0
	};
	game.poker.cards = [
		['ace', 'clubs', true], ['ace', 'diamonds', true], ['ace', 'hearts', true], ['ace', 'spades', true],
		['2', 'clubs', true], ['2', 'diamonds', true], ['2', 'hearts', true], ['2', 'spades', true],
		['3', 'clubs', true], ['3', 'diamonds', true], ['3', 'hearts', true], ['3', 'spades', true],
		['4', 'clubs', true], ['4', 'diamonds', true], ['4', 'hearts', true], ['4', 'spades', true],
		['5', 'clubs', true], ['5', 'diamonds', true], ['5', 'hearts', true], ['5', 'spades', true],
		['6', 'clubs', true], ['6', 'diamonds', true], ['6', 'hearts', true], ['6', 'spades', true],
		['7', 'clubs', true], ['7', 'diamonds', true], ['7', 'hearts', true], ['7', 'spades', true],
		['8', 'clubs', true], ['8', 'diamonds', true], ['8', 'hearts', true], ['8', 'spades', true],
		['9', 'clubs', true], ['9', 'diamonds', true], ['9', 'hearts', true], ['9', 'spades', true],
		['10', 'clubs', true], ['10', 'diamonds', true], ['10', 'hearts', true], ['10', 'spades', true],
		['jacks', 'clubs', true], ['jacks', 'diamonds', true], ['jacks', 'hearts', true], ['jacks', 'spades', true],
		['queens', 'clubs', true], ['queens', 'diamonds', true], ['queens', 'hearts', true], ['queens', 'spades', true],
		['kings', 'clubs', true], ['kings', 'diamonds', true], ['kings', 'hearts', true], ['kings', 'spades', true]
	];
	game.poker.status = 'round-end';
	game.poker.activePlayer = '';
}