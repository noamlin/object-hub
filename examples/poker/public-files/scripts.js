"use strict";

var poker, name, myID, me, playersElm, consoleElm;
var pokerStatuses = ['reset', 'waiting for players', 'pre flop', 'flop', 'turn', 'river', 'finish game'];
var playerStatuses = ['waiting to play', 'now playing', 'played', 'fold'];

function isNumeric(variable) {
	if(typeof variable === 'string' && variable === '') return false;
	else return !isNaN(variable);
}

function clearElementContent(elm) {
	while(elm.firstChild) elm.removeChild(elm.firstChild);
}

window.addEventListener('DOMContentLoaded', (event) => {
	let loginBtn = document.querySelector('div.login > button');
	let nicknameInput = document.querySelector('div.login > input');
	loginBtn.addEventListener('click', (event) => {
		name = nicknameInput.value.trim();
		if(name === '') {
			alert('Please choose a nickname!');
		} else {
			let pokerInstance = new OH('poker', (obj) => {
				poker = obj;
				myID = pokerInstance.id;
				beginGame();
			}, {nickname: name});
		}
	});

	let resetBtn = document.querySelector('#control-buttons > .reset-game');
	resetBtn.addEventListener('click', resetGame);

	let disconnectBtn = document.querySelector('#control-buttons > .disconnect');
	disconnectBtn.addEventListener('click', (event) => {
		location.reload();
	});

	let betAmount = document.querySelector('#bet-bar > input');
	let betBtn = document.querySelector('#bet-bar > .bet');
	betBtn.addEventListener('click', (event) => {
		makeBet(parseInt(betAmount.value));
		betAmount.value = 0;
	});

	let foldBtn = document.querySelector('#bet-bar > .fold');
	foldBtn.addEventListener('click', (event) => {
		fold();
	});
});

function beginGame() {
	document.querySelector('div.login').style.display = 'none';
	document.querySelector('div.game').style.display = 'block';
	playersElm = document.querySelector('div.game div#players');
	consoleElm = document.querySelector('div.console');

	UI.updateStatus();
	poker.on('change', '.status', onChange.status);
	poker.on('change', '.currentPlayer', onChange.currentPlayer);
	poker.on('change', '.table.chips', onChange.table.chips);
	poker.on('change', '.table.flop', onChange.table.flop);
	poker.on('change', '.table.turn', onChange.table.turn);
	poker.on('change', '.table.river', onChange.table.river);
	poker.on('change', '.log', onChange.gameLog);
	updatePlayersList();
	poker.players.on('change', onChange.players);

	for(let i=0; i < poker.log.length; i++) {
		if(typeof poker.log[i] === 'string') UI.addLog(i, poker.log[i]);
	}
}

function resetGame() {
	poker.status = pokerStatuses[0];
}

var UI = {
	updateStatus: function() {
		document.querySelector('div.game #game-status > span').textContent = (typeof poker.status !== undefined) ? poker.status : '';
	},
	updatePlayerInfo: function(player) {
		let span, place;
		try {
			({span, place} = UI.playerElementsMap.get(player));
		} catch(error) {
			console.warn(error.message);
			return;
		}
		
		let name = player.name;
		if(player === me) {
			name += ' (ME)';
		}

		let status = player.status;
		if(poker.players[poker.dealer] === player) {
			status += ' (Dealer)';
		}

		let color = 'inherit';
		if(poker.players[poker.currentPlayer] === player) {
			color = 'rgb(100,240,255)';
		}

		span.style.color = color;
		span.textContent = `${place}) ${name} [chips: ${player.chips}, status: ${status}]`;
	},
	updateMyCards: function() {
		let myCardsElm = document.querySelector('div.game #my-cards > span');
		clearElementContent(myCardsElm);
		if(Array.isArray(me.personal.cards)) {
			for(let card of me.personal.cards) {
				let cardElm = UI.createCardElm(card);
				myCardsElm.appendChild(cardElm);
			}
		}
	},
	createCardElm: function(card) {
		let span = document.createElement('span');
		span.classList.add('card');
		let rank;
		switch(card.rank) {
			case 11: rank = 'J'; break;
			case 12: rank = 'Q'; break;
			case 13: rank = 'K'; break;
			case 14: rank = 'A'; break;
			default: rank = card.rank;
		}
		let img = document.createElement('img');
		img.src = `/public-files/images/icon-${card.suit}.png`;
		span.textContent = rank + ' ';
		span.appendChild(img);
		return span;
	},
	updateChips: function() {
		document.querySelector('#table .chips').textContent = poker.table.chips;
	},
	updateFlop: function() {
		let flopElm = document.querySelector('#table .flop');
		clearElementContent(flopElm);
		for(let card of poker.table.flop) {
			if(card) {
				let cardElm = UI.createCardElm(card);
				flopElm.appendChild(cardElm);
			}
		}
	},
	updateTurn: function() {
		let turnElm = document.querySelector('#table .turn');
		clearElementContent(turnElm);
		if(poker.table.turn) {
			let cardElm = UI.createCardElm(poker.table.turn);
			turnElm.appendChild(cardElm);
		}
	},
	updateRiver: function() {
		let riverElm = document.querySelector('#table .river');
		clearElementContent(riverElm);
		if(poker.table.river) {
			let cardElm = UI.createCardElm(poker.table.river);
			riverElm.appendChild(cardElm);
		}
	},
	addLog: function(index, msg) {
		let wasScrolledToBottom = (consoleElm.offsetHeight + consoleElm.scrollTop >= consoleElm.scrollHeight -5);
		let span = document.createElement('span');
		span.classList.add('log-'+index);
		span.textContent = msg;
		span.appendChild(document.createElement('br'));
		consoleElm.appendChild(span);
		//keep scrolling the console to the bottom if it was at the bottom before
		if(wasScrolledToBottom) {
			setTimeout(() => { consoleElm.scrollTo(0, consoleElm.scrollHeight - consoleElm.offsetHeight); }, 1);
		}
	},
	removeLog: function(index) {
		consoleElm.removeChild( consoleElm.querySelector('span.log-'+index) );
	},
	playerElementsMap: new WeakMap()
};

var onChange = {
	status: function(changes) {
		UI.updateStatus();
	},
	currentPlayer: function(changes) {
		updatePlayersList();
	},
	table: {
		chips: UI.updateChips,
		flop: UI.updateFlop,
		turn: UI.updateTurn,
		river: UI.updateRiver,
	},
	gameLog: function(changes) {
		for(let change of changes) {
			let index = Proxserve.splitPath(change.path);
			if(change.type === 'create') {
				UI.addLog(index, change.value);
			} else if(change.type === 'delete') {
				UI.removeLog(index);
			} else {
				console.warn('Unexpected log message', change);
			}
		}
	},
	players: function(changes) {
		for(let change of changes) {
			let segments = Proxserve.splitPath(change.path);
			//path leads to one property which is a direct cell of the array, meaning the object of a player
			if(isNumeric(segments[0])) {
				if(segments.length === 1) {
					updatePlayersList();
					return;
				} else {
					UI.updatePlayerInfo(this[segments[0]]);
				}
			}
		}
	},
	me: function(changes) {
		UI.updateMyCards();
	}
};

//create 'me' or update its reference, so following code won't throw
function updateMe() {
	if(me) {
		me.personal.removeAllListeners(); //remove listener of old 'me'
	}
	
	for(let i = 0; i < poker.players.length; i++) {
		let player = poker.players[i];
		if(player.id === myID) {
			me = player;
			UI.updateMyCards();
			me.personal.on('change', onChange.me);
			break;
		}
	}
}

function updatePlayersList() {
	updateMe();

	clearElementContent(playersElm);

	for(let i=0; i < poker.players.length; i++) {
		let player = poker.players[i];
		player.removeAllListeners(); //removes all listeners of 'player'
		let place = i+1;
		
		let span = document.createElement('span');

		if(player === me) { //found 'me' so do some stuff related only to me
			if(i === poker.currentPlayer && me.status !== playerStatuses[3]) { //i'm the current player
				me.status = playerStatuses[1];
				document.querySelector('#bet-bar').style.display = 'block';
			} else {
				document.querySelector('#bet-bar').style.display = 'none';
			}
		}

		UI.playerElementsMap.set(player, {span: span, place: place});
		UI.updatePlayerInfo(player);
		playersElm.appendChild(span);
		playersElm.appendChild(document.createElement('br'));
	}
}

function nextPlayer() {
	if(getWinner()) {
		return;
	}
	
	if(poker.currentPlayer === poker.dealer) { //the dealer just finished playing
		nextRound();
	}
	else { //advances the 'currentPlayer'
		let player;
		do {
			if(poker.currentPlayer === poker.dealer) {
				//about to the advance after the dealer meaning the round was ended
				nextRound();
				break;
			}

			poker.currentPlayer++;
			if(poker.currentPlayer >= poker.players.length) {
				poker.currentPlayer = 0;
			}
			player = poker.players[ poker.currentPlayer ];
		} while(player.status === playerStatuses[3]/*fold*/);
	}
}

function nextRound() {
	if(poker.status === pokerStatuses[2]) { //pre flop
		resetCurrentPlayer();
		poker.status = pokerStatuses[3];
	} else if(poker.status === pokerStatuses[3]) { //flop
		resetCurrentPlayer();
		poker.status = pokerStatuses[4];
	} else if(poker.status === pokerStatuses[4]) { //turn
		resetCurrentPlayer();
		poker.status = pokerStatuses[5];
	} else { //finished all rounds
		poker.status = pokerStatuses[6];
	}
}

function resetCurrentPlayer() {
	poker.currentPlayer = poker.dealer + 1; //next player after dealer

	for(let i=0; i < poker.players.length; i++) {
		let player = poker.players[i];

		if(player.status === playerStatuses[2]) {
			player.status = playerStatuses[0];
		}

		if(poker.currentPlayer >= poker.players.length) {
			poker.currentPlayer = 0;
		}
		if(poker.players[ poker.currentPlayer ].status === playerStatuses[3]) {
			poker.currentPlayer++; //keep advancing as long as players are folded
		}
	}
}

function makeBet(amount) {
	if(!(amount > 0)) {
		alert('You must bet on at least 1 chip');
	} else if(me.chips < amount) {
		alert('You can\'t bet on more than you have');
	} else {
		me.chips -= amount;
		poker.table.chips += amount;
		me.status = playerStatuses[2];
		poker.log.push(`${me.name} has bet on ${amount} chip${amount > 1 ? 's' : ''}`);
		nextPlayer();
	}
}

function fold() {
	me.status = playerStatuses[3];
	poker.log.push(`${me.name} folded`);
	nextPlayer();
}

function getWinner() {
	if(poker.status !== pokerStatuses[1]) {
		let playingPlayers = [];
		for(let player of poker.players) {
			if(player.status !== playerStatuses[3]) { //not folded
				playingPlayers.push(player);
				if(playingPlayers.length >= 2) return false; //game has enough players to continue
			}
		}

		if(playingPlayers.length === 1) { //only one remaining player. all others have folded
			let player = playingPlayers[0];
			player.chips += poker.table.chips;
			poker.log.push(`${player.name} won ${poker.table.chips} chips`);
			resetGame();
			return true;
		}
	}

	return false;
}