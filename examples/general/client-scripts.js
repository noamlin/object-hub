"use strict";

window.addEventListener('DOMContentLoaded', (event) => {
	var numClients = 4;
	var OHs = {};
	var trInputs = document.querySelector('table > tbody > tr:first-child');
	var trObj = document.querySelector('table > tbody > tr:last-child');

	for(let i = 0; i < numClients; i++) {
		OHs[i] = new Oh('game', {level: i});

		let td = document.createElement('td');
		let span = document.createElement('span');
		let input = document.createElement('input');

		input.addEventListener('keyup', (event) => {
			if(event.key === 'Enter') {
				let code = `OHs[${i}].game.${event.currentTarget.value}`;
				try {
					eval(code);
				} catch(e) {
					//
				}
				event.currentTarget.value = '';
			}
		});
		span.textContent = `OHs[${i}].game.`;
		td.appendChild(span);
		td.appendChild(input);
		trInputs.appendChild(td);

		td = document.createElement('td');
		let pre = document.createElement('pre');
		td.appendChild(pre);
		trObj.appendChild(td);

		setInterval(() => {
			pre.textContent = JSON.stringify(OHs[i].game, undefined, 4);
		}, 260);
	}
});