"use strict";

var game, name, myID, me;
var playersElm;

window.addEventListener('DOMContentLoaded', (event) => {
	let loginBtn = document.querySelector('div.login > button');
	let nicknameInput = document.querySelector('div.login > input');
	loginBtn.addEventListener('click', (event) => {
		name = nicknameInput.value.trim();
		if(name === '') {
			alert('Please choose a nickname!');
		} else {
			game = new OH('poker', {nickname: name}, () => {
				myID = game.id;
				beginGame();
			});
		}
	});
});

function beginGame() {
	for(let i=0; i < game.poker.players.length; i++) {
		if(game.poker.players[i] && game.poker.players[i].id === myID) {
			me = game.poker.players[i];
			break;
		}
	}
	document.querySelector('div.login').style.display = 'none';
	document.querySelector('div.game').style.display = 'block';
	updateStatus();
	playersElm = document.querySelector('div.game div.players');
	updateActivePlayer();
	updatePlayersList();
	if(me.personal.auth === 'admin') {
		document.querySelector('div.game div.admin-panel').style.display = 'block';
	}

	game.poker.on('change', (changes) => {
		//TODO - THIS SHOULD NOT HAPPEN. i should not search for myself again and again
		for(let i=0; i < game.poker.players.length; i++) {
			if(game.poker.players[i] && game.poker.players[i].id === myID) {
				me = game.poker.players[i];
				break;
			}
		}

		switch(changes[0].path) {
			case '.status': updateStatus(); break;
			case '.activePlayer': updateActivePlayer(); break;
		}
		if(changes[0].path.indexOf('.players') >= 0) {
			updatePlayersList();
		}
	});
}

function updateStatus() {
	document.querySelector('div.game span.game-status').textContent = game.poker.status;
}
function updateActivePlayer() {
	document.querySelector('div.game span.now-playing').textContent = game.poker.activePlayer;
}
function updatePlayersList() {
	while(playersElm.firstChild){
		playersElm.removeChild(playersElm.firstChild);
	}

	for(let i=0; i < game.poker.players.length; i++) {
		if(!game.poker.players[i]) continue;

		let span = document.createElement('span');
		span.textContent = `player #${i+1} - name: ${game.poker.players[i].name} - chips: ${game.poker.players[i].chips}`;
		if(game.poker.players[i].id === me.id) {
			span.style.color = '#70B0FF';
		}
		playersElm.appendChild(span);
		playersElm.appendChild(document.createElement('br'));
	}
}