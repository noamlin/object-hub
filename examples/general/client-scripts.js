"use strict";

window.addEventListener('DOMContentLoaded', (event) => {
	var numClients = 4;
	var OHs = {};
	var trInputs = document.querySelector('table > tbody > tr:first-child');
	var trObj = document.querySelector('table > tbody > tr:last-child');

	var people = [
		{ name: 'John', levels: [1,2] },
		{ name: 'Oliver', levels: [2,3] },
		{ name: 'Mike', levels: [3,4] },
		{ name: 'Larry', levels: [4,1] }
	];

	for(let i = 0; i < numClients; i++) {
		OHs[i] = new OH('demo', people[i]);

		let td = document.createElement('td');
		let span = document.createElement('span');
		let input = document.createElement('input');

		input.addEventListener('keyup', (event) => {
			if(event.key === 'Enter') {
				let code = `OHs[${i}].demo.${event.currentTarget.value}`;
				try {
					eval(code);
				} catch(e) {
					//
				}
				event.currentTarget.value = '';
			}
		});
		span.textContent = `OHs[${i}].demo.`;
		td.appendChild(span);
		td.appendChild(input);
		trInputs.appendChild(td);

		td = document.createElement('td');
		let pre = document.createElement('pre');
		td.appendChild(pre);
		trObj.appendChild(td);

		setInterval(() => {
			pre.textContent = JSON.stringify(OHs[i].demo, undefined, 4);
		}, 260);
	}
});