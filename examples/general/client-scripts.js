"use strict";

class ClientBlock extends HTMLElement {
	constructor() {
		super();
		
		let infoDiv = document.createElement('div');
		infoDiv.classList.add('info');
		infoDiv.appendChild(document.createElement('span'));

		let editorDiv = document.createElement('div');
		editorDiv.classList.add('editor');
		editorDiv.appendChild(document.createElement('span'));
		editorDiv.appendChild(document.createElement('input'));

		let viewerDiv = document.createElement('div');
		viewerDiv.classList.add('viewer');
		viewerDiv.appendChild(document.createElement('pre'));

		let linkElem = document.createElement('link');
		linkElem.setAttribute('rel', 'stylesheet');
		linkElem.setAttribute('href', '/styles.css');

		let shadow = this.attachShadow({mode: 'open'});
		shadow.append(linkElem/*child 0*/, infoDiv, editorDiv, viewerDiv);
	}
};
customElements.define('client-block', ClientBlock);

var OHs = [];
var demos = [];

window.addEventListener('DOMContentLoaded', (event) => {
	var people = [
		{ name: 'John', levels: [1,2,7,8,'admin'] },
		{ name: 'Oliver', levels: [2,3,8,5,'moderator'] },
		{ name: 'Mike', levels: [3,4,5,6,'manager'] },
		{ name: 'George', levels: [4,1,6,7,'peasant'] },
		{ name: 'Larry', levels: [1,3,4,8,'power-user'] },
		{ name: 'GOD', levels: [1,2,3,4,5,6,7,8,'god'] }
	];
	
	for(let i = 0; i < people.length; i++) {
		OHs[i] = new OH('demo', people[i], (obj) => { demos[i] = obj; });

		let clientBlock = document.createElement('client-block');
		document.body.appendChild(clientBlock);

		//create row of client's info
		let infoDiv = clientBlock.shadowRoot.childNodes[1];
		infoDiv.querySelector('span').innerHTML = `<span style="text-decoration:underline;">Name:</span> ${people[i].name}. &nbsp; <span style="text-decoration:underline;">Auth Levels:</span> ${people[i].levels}`;

		//create input row for injecting scripts
		let editorDiv = clientBlock.shadowRoot.childNodes[2];
		editorDiv.querySelector('input').addEventListener('keyup', (event) => {
			if(event.key === 'Enter') {
				let code = `demos[${i}].${event.currentTarget.value}`;
				try {
					eval(code);
				} catch(e) {
					console.error(e);
				}
				event.currentTarget.value = '';
			}
		});
		editorDiv.querySelector('span').textContent = `demos[${i}].`;

		//create row elements that show the live data
		let viewerDiv = clientBlock.shadowRoot.childNodes[3];
		let pre = viewerDiv.querySelector('pre');

		setInterval(() => {
			pre.textContent = JSON.stringify(demos[i], undefined, 4);
		}, 260);
	}
});