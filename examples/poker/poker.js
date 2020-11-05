"use strict"

const path = require('path');
const baseDir = path.resolve(__dirname, '../../');
const http = require('http');
const express = require('express');
const app = express();
const OH = require(`${baseDir}/index.js`);
const { cloneDeep } = require('lodash');
const { arraySort } = require('../../utils/sort.js');

const server = http.createServer(app);
server.listen(1337);

app.get('/', (req, res) => { res.sendFile(`${baseDir}/examples/poker/index.html`); });
app.get(/\/game\d*.html/, (req, res) => { res.sendFile(`${baseDir}/examples/poker/game.html`); });

app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client-side/dist/oh.js`); });
app.get('/oh.js.map', (req, res) => { res.sendFile(`${baseDir}/client-side/dist/oh.js.map`); });

app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/dist/proxserve.js`); });
app.get('/proxserve.js.map', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/dist/proxserve.js.map`); });

app.use('/public-files', express.static(`${baseDir}/examples/poker/public-files`));

var pokerDefaults = {
	players: [],
	cards: { available: [], dealt: [] },
	table: {
		flop: [null, null, null],
		turn: null,
		river: null,
		chips: 0
	},
	log: []
};
for(let suit of ['clubs','diamonds','hearts','spades']) {
	for(let rank of [2,3,4,5,6,7,8,9,10,11,12,13,14]) {
		pokerDefaults.cards.available.push({ suit: suit, rank: rank });
	}
}

var pokerStatuses = ['reset', 'waiting for players', 'pre flop', 'flop', 'turn', 'river', 'finish game'];
var playerStatuses = ['waiting to play', 'now playing', 'played', 'fold'];
var hands = ['High card','Pair','Two Pairs','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush','Royal flush'];

var poker = new OH('poker', server, cloneDeep(pokerDefaults));
var pokerInstance = OH.getInstance(poker);

pokerInstance.setPermissions('cards', 'no_one', 'no_one');
resetGame();

pokerInstance.on('connection', function(client, clientData, init) {
	client.nickname = clientData.nickname;
	console.log(`Client ${client.nickname} connected`);
	gameLog(`Player ${client.nickname} connected`);

	if(this.clients.size > 8) {
		return; //don't connect more than 8 players
	}

	let id = client.id;

	poker.players.push({
		id: id,
		name: clientData.nickname,
		chips: 1000,
		status: playerStatuses[3],
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
	gameLog(`Player ${client.nickname} disconnected`);

	let id = client.id;
	for(let i = poker.players.length-1; i >= 0; i--) {
		if(poker.players[i] && poker.players[i].id === id) {
			//will change places of cells and cause clients to create a whole new objects instead of replacing the existing ones
			poker.players.splice(i, 1);
			break;
		}
	}
	if(this.clients.size < 2) {
		resetGame();
	}
});

poker.players.on('change', function(changes) {
	for(let change of changes) {
		let {object, property} = OH.evalPath(poker.players, change.path);
		if(object === this) {
			//after evaluation of the path we stayed on the same object so the path was to a direct property (index) of this array.
			//meaning a new player was added or one was deleted
			updatePlayerPermissions(property);
		}
	}
});

pokerInstance.on('client-change', function(changes, client, commitChange) {
	for(let change of changes) {
		let allowChange = true;
		if(change.path === '.status') {
			if(change.value === pokerStatuses[0]) { //reset
				allowChange = false;
				resetGame(); //status will be changed by resetGame()
			} else if(change.value === pokerStatuses[3]) { //flop
				poker.table.flop = fetchCards(3);
				gameLog(`Advancing to flop`);
			} else if(change.value === pokerStatuses[4]) { //turn
				poker.table.turn = fetchCards(1)[0];
				gameLog(`Advancing to turn`);
			} else if(change.value === pokerStatuses[5]) { //river
				poker.table.river = fetchCards(1)[0];
				gameLog(`Advancing to river`);
			} else if(change.value === pokerStatuses[6]) { //finish game
				allowChange = false;
				let winners = [];
				for(let player of poker.players) {
					if(player.status === playerStatuses[3]) { //fold
						continue;
					}

					let hand = calculateBestHand([...player.personal.cards, ...poker.table.flop, poker.table.turn, poker.table.river]);
					if(winners.length === 0 || winners[0].hand === hand) winners.push({'player': player, 'hand': hand}); //add to winners list
					else if(winners[0].hand < hand) winners = [{'player': player, 'hand': hand}]; //overwrite previous list
				}

				if(winners.length === 1) {
					gameLog(`${winners[0].player.name} won ${poker.table.chips} chips with ${hands[ winners[0].hand ]}!`);
					winners[0].player.chips += poker.table.chips;
				} else if(winners.length > 1) {
					let names = '';
					let chipsFloor = Math.floor(poker.table.chips / winners.length);
					let extra = poker.table.chips % winners.length;
					for(let i=0; i < winners.length; i++) {
						winners[i].player.chips += chipsFloor;
						if(i === 0) {
							names += winners[i].player.name;
						} else if(i === winners.length-1) {
							names += ' and ' + winners[i].player.name;
							winners[i].player.chips += extra;
						} else {
							names += ', ' + winners[i].player.name;
						}
					}
					gameLog(`${names} won ${chipsFloor} chips each with ${hands[ winners[0].hand ]}!`);
				} else {
					console.error(`A game was finished with no winners`);
				}

				resetGame();
			}
		}

		if(allowChange) commitChange(change); //allow change
		else commitChange(change, false, ''); //disallow with no reason

		if(change.path.substring(0,4) === '.log') {
			trimGameLog(100);
		}
	}
});

function updatePlayerPermissions(index) {
	if(typeof poker.players[index] === 'object') { //the player wasn't deleted
		//only client himself can write:
		pokerInstance.setPermissions(`.players[${index}]`, 0, poker.players[index].id);
		//only client himself can read & write:
		pokerInstance.setPermissions(`.players[${index}].personal`, poker.players[index].id, poker.players[index].id);
		//anyone can write:
		pokerInstance.setPermissions(`.players[${index}].status`, 0, 0);
	}
}

function resetGame() {
	poker.table = cloneDeep(pokerDefaults.table);
	poker.cards = cloneDeep(pokerDefaults.cards);

	if(poker.players.length > 1) {
		dealCards();
		poker.status = pokerStatuses[2]; //pre flop

		poker.dealer++; //will force a change no matter what
		if(poker.dealer >= poker.players.length) poker.dealer = 0;
		poker.currentPlayer = poker.dealer + 1; //will force a change no matter what
		if(poker.currentPlayer >= poker.players.length) poker.currentPlayer = 0;

		gameLog(`Starting a new round`);
	}
	else {
		poker.status = pokerStatuses[1]; //waiting for players
		poker.dealer = -1;
		poker.currentPlayer = -1;
		gameLog(`Resetting and waiting for players..`);
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
		player.status = playerStatuses[0];
	}
}

function gameLog(str) {
	poker.log.push(str);
	trimGameLog(100);
}
function trimGameLog(trimTo) {
	let oldestMessage = poker.log.length - trimTo;
	if(oldestMessage >= 0) {
		delete poker.log[oldestMessage];
	}
}

/**
 * super simple algorithm full of mistakes :D
 * @param {Array.<Object>} cards 
 */
function calculateBestHand(cards) {
	arraySort(cards, 'rank');

	let consecutive = 0, suits = {'clubs':0,'diamonds':0,'hearts':0,'spades':0}, sameRank=0,
		ofakind={'0':0,'2':0,'3':0,'4':0}, straight = false, flush = false, royalStraigt = false, suitOfFlush;
	
	//check for any hits
	for(let i=0; i < cards.length; i++) {
		let card = cards[i];

		suits[ card.suit ]++;
		if(!flush && suits[ card.suit ] === 5) {
			flush = true;
			suitOfFlush = card.suit;
		}

		if(i === 0) continue;

		if(cards[i-1].rank === card.rank) {
			sameRank = (sameRank === 0) ? 2 : sameRank+1;
		} else {
			ofakind[ sameRank ]++;
			sameRank = 0; //reset

			if(cards[i-1].rank === card.rank - 1) {
				consecutive = (consecutive === 0) ? 2 : consecutive+1;
				
				if(consecutive >= 5) {
					straight = true;
					if(card.rank === 14) royalStraigt = true; //straight with Ace as top card
				}
				else if(consecutive === 4 && card.rank === 5) { //special case for a straight with Ace,2,3,4,5
					for(let tmpCard of cards) {
						if(tmpCard.rank === 14) straight = true;
					}
				}
			} else { //difference between current card and previous card is 2 or more
				consecutive = 0;
			}
		}
	}

	ofakind[ sameRank ]++; //if finished with a pair or three of a king etc.

	//calculate scoring by hits
	if(straight && flush) {
		consecutive = 0
		let sameSuit = 0;
		for(let i=1; i < cards.length; i++) {
			if(cards[i-1].rank === cards[i].rank - 1) consecutive = (consecutive === 0) ? 2 : consecutive+1;
			else consecutive = 0;

			if(cards[i-1].suit === cards[i].suit) sameSuit = (sameSuit === 0) ? 2 : sameSuit+1;
			else sameSuit = 0;

			if(consecutive >= 5 && sameSuit >= 5) { //the 5 cards with flush are the same cards with straight
				if(royalStraigt) return 9;
				else return 8;
			}
		}
	}
	if(ofakind['4'] > 0) return 7;
	if(ofakind['3'] > 0 && ofakind['2'] > 0) return 6;
	if(flush) return 5;
	if(straight) return 4;
	if(ofakind['3'] > 0) return 3;
	if(ofakind['2'] > 1) return 2;
	if(ofakind['2'] === 1) return 1;

	return 0;
}