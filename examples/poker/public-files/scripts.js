"use strict";

var poker, name, myID, me;
var playersElm;

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
				myID = poker.id;
				beginGame();
			});
		}
	});
});

function beginGame() {
	for(let i=0; i < poker.players.length; i++) {
		if(poker.players[i] && poker.players[i].id === myID) {
			me = poker.players[i];
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

	poker.on('change', (changes) => {
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
	document.querySelector('div.game span.game-status').textContent = poker.status;
}
function updateActivePlayer() {
	document.querySelector('div.game span.now-playing').textContent = poker.activePlayer;
}
function updatePlayersList() {
	while(playersElm.firstChild){
		playersElm.removeChild(playersElm.firstChild);
	}

	for(let i=0; i < poker.players.length; i++) {
		if(!poker.players[i]) continue;

		let span = document.createElement('span');
		span.textContent = `player #${i+1} - name: ${poker.players[i].name} - chips: ${poker.players[i].chips}`;
		if(poker.players[i].id === me.id) {
			span.style.color = '#70B0FF';
		}
		playersElm.appendChild(span);
		playersElm.appendChild(document.createElement('br'));
	}
}