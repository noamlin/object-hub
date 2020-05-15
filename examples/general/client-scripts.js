"use strict";

window.addEventListener('DOMContentLoaded', (event) => {
	var numClients = 4;
	var OHs = [];
	var demos = [];
	var TRs = document.querySelectorAll('table > tbody > tr');

	var people = [
		{ name: 'John', levels: [1,2,'admin'] },
		{ name: 'Oliver', levels: [2,3,'moderator'] },
		{ name: 'Mike', levels: [3,4,'manager'] },
		{ name: 'Larry', levels: [4,1,9,'peasant'] }
	];

	for(let i = 0; i < numClients; i++) {
		OHs[i] = new OH('demo', people[i], (obj) => { demos[i] = obj; });

		let td = document.createElement('td');
		let span = document.createElement('span');
		let input = document.createElement('input');

		//create input row for injecting scripts
		input.addEventListener('keyup', (event) => {
			if(event.key === 'Enter') {
				let code = `demos[${i}].${event.currentTarget.value}`;
				try {
					eval(code);
				} catch(e) {
					//
				}
				event.currentTarget.value = '';
			}
		});
		span.textContent = `demos[${i}].`;
		td.appendChild(span);
		td.appendChild(input);
		TRs[1].appendChild(td);

		//create row elements that show the live data
		td = document.createElement('td');
		let pre = document.createElement('pre');
		td.appendChild(pre);
		TRs[2].appendChild(td);

		//create row of client's info
		td = document.createElement('td');
		span = document.createElement('span');
		span.innerHTML = `<span style="text-decoration:underline;">Name:</span> ${people[i].name}. &nbsp; <span style="text-decoration:underline;">Auth Levels:</span> ${people[i].levels}`;
		td.appendChild(span);
		TRs[0].appendChild(td);

		setInterval(() => {
			pre.textContent = JSON.stringify(demos[i], undefined, 4);
		}, 260);
	}
});