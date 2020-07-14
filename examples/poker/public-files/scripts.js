"use strict";

var poker, name, myID, me, playersElm;

function isNumeric(variable) {
	if(typeof variable === 'string' && variable === '') return false;
	else return !isNaN(variable);
}

window.addEventListener('DOMContentLoaded', (event) => {
	let loginBtn = document.querySelector('div.login > button');
	let nicknameInput = document.querySelector('div.login > input');
	loginBtn.addEventListener('click', (event) => {
		name = nicknameInput.value.trim();
		if(name === '') {
			alert('Please choose a nickname!');
		} else {
			let pokerInstance = new OH('poker', {nickname: name}, (obj) => {
				poker = obj;
				myID = pokerInstance.id;
				beginGame();
			});
		}
	});

	let resetBtn = document.querySelector('#reset-game');
	resetBtn.addEventListener('click', (event) => {
		poker.status = 'reset';
	});

	let disconnectBtn = document.querySelector('#disconnect');
	disconnectBtn.addEventListener('click', (event) => {
		location.reload();
	});
});

function beginGame() {
	document.querySelector('div.login').style.display = 'none';
	document.querySelector('div.game').style.display = 'block';
	UI.updateStatus();
	playersElm = document.querySelector('div.game div.players');
	UI.updateCurrentPlayer();
	updatePlayersList();

	poker.players.on('change', (changes) => {
		for(let change of changes) {
			let segments = Proxserve.splitPath(change.path);
			if(segments.length === 1 && isNumeric(segments[0])) { //path leads to one property which is a direct cell of the array
				updatePlayersList();
			}
		}
	});

	poker.on('change', (changes) => {
		for(let change of changes) {
			switch(change.path) {
				case '.status': UI.updateStatus(); break;
				case '.currentPlayer': UI.updateCurrentPlayer(); break;
			}
		}
	});
}

var UI = {
	updateStatus: function() {
		document.querySelector('div.game span.game-status').textContent = (typeof poker.status !== undefined) ? poker.status : '';
	},
	updateCurrentPlayer: function() {
		let name = '';
		if(poker.players[poker.currentPlayer]) name = poker.players[poker.currentPlayer].name;
		document.querySelector('div.game span.now-playing').textContent = name;
	},
	updatePlayerInfo: function(span, player, place) {
		span.textContent = `${place}) ${player.name} [chips: ${player.chips}]`;
	},
	updateMyCards() {
		let cardsInfo = '';
		if(Array.isArray(me.personal.cards)) {
			for(let card of me.personal.cards) {
				cardsInfo += `${card.number} ${card.type} `;
			}
		}
		document.querySelector('div.game span.my-cards').textContent = cardsInfo;
	}
};

//create 'me' or update its reference, so following code won't throw
function updateMe() {
	for(let i = 0; i < poker.players.length; i++) {
		let player = poker.players[i];
		if(player.id === myID) {
			me = player;
			UI.updateMyCards();
			break;
		}
	}
}

function updatePlayersList() {
	updateMe();

	while(playersElm.firstChild){
		playersElm.removeChild(playersElm.firstChild);
	}

	for(let i=0; i < poker.players.length; i++) {
		let player = poker.players[i];
		player.removeAllListeners(); //removes all listeners of 'player' which might also be listeners of 'me'
		let place = i+1;

		let span = document.createElement('span');
		UI.updatePlayerInfo(span, player, place);

		if(player.id === myID) { //found 'me' so do some stuff related only to me
			me = player;
			UI.updateMyCards();
			span.style.color = '#70B0FF';
			me.on('change', (changes) => {
				for(let change of changes) {
					if(change.path === '.personal.cards') {
						UI.updateMyCards();
					}
				}
			});
		}
		
		playersElm.appendChild(span);
		playersElm.appendChild(document.createElement('br'));

		player.on('change', (changes) => {
			UI.updatePlayerInfo(span, player, place);
		});
	}
}