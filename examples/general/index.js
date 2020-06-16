"use strict"

const path = require('path');
const baseDir = path.resolve(__dirname, '../../');
const http = require('http');
const express = require('express');
const app = express();
const OH = require(`${baseDir}/index.js`);
const { isNumeric } = require(`${baseDir}/utils/variables.js`);

const server = http.createServer(app);
server.listen(1337);

app.get('/', (req, res) => { res.sendFile(`${baseDir}/examples/general/index.html`); });
app.get('/styles.css', (req, res) => { res.sendFile(`${baseDir}/examples/general/styles.css`); });
app.get('/scripts.js', (req, res) => { res.sendFile(`${baseDir}/examples/general/client-scripts.js`); });
app.get('/oh.js', (req, res) => { res.sendFile(`${baseDir}/client-side/oh.js`); });
app.get('/proxserve.js', (req, res) => { res.sendFile(`${baseDir}/node_modules/proxserve/index.js`); });

let infrastructure = {
	free_for_all: {
		regular_object: {
			primitive1: 1,
			primitive2: 'a',
			primitive3: true
		},
		an_array: [1, true, 'a']
	},
	must_1: {
		open: 'this requires one permission',
		must_2: 'this requires two different permissions'
	},
	or_34: {
		open: 'this requires authorization over one level',
		or_12: 'this requires authorization over two different levels'
	},
	must_and_or: {
		must_1: {
			or_23: {
				must_4: [
					{ or_56: 0 },
					{ or_56: 1 },
					{ or_78: 2 }
				]
			}
		},
		or_12: {
			must_3: {
				or_45: [
					{ must_7: 0 },
					{ must_6: 1 },
					{ must_6: 2 }
				]
			}
		}
	},
	dynamic: {}
};

var demo = new OH('demo', server, infrastructure);
var demoInstance = OH.getInstance(demo);

//demoInstance.setPermissions('', 0, 0);
demoInstance.setPermissions('must_1', 1, 1);
demoInstance.setPermissions('must_1.must_2', 2, 2);
demoInstance.setPermissions('or_34', [3,4], [3,4]);
demoInstance.setPermissions('or_34.or_12', [1,2], 4);
demoInstance.setPermissions('must_and_or', null, null);
demoInstance.setPermissions('must_and_or.must_1', 1, 1);
demoInstance.setPermissions('must_and_or.must_1.or_23', [2,3]);
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4', 4);
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4[0-1].or_56', [5,6]);
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4[2].or_78', [7,8]);
demoInstance.setPermissions('must_and_or.or_12', [1,2], [1,2]);
demoInstance.setPermissions('must_and_or.or_12.must_3', 3);
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45', [4,5]);
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45[1-2].must_6', 6, 6);
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45[0].must_7', 7, 7);

demoInstance.on('connection', function(client, clientData, init) {
	if(clientData) {
		let id = client.id;
		this.setPermissions(`dynamic.${id}.secret`, [id,'god'], [id,'god']); //only client himself can read/write this secret
	
		demo.dynamic[id] = {
			name: clientData.name,
			age: Math.floor(Math.random()*30+20),
			secret: Math.floor(Math.random()*10000)
		};
	
		client.setPermissions(clientData.levels, clientData.levels);
	}
	else {
		console.error('Client connected with missing data');
	}

	console.log(`client ${client.id} was added`);
	init();
});
demoInstance.on('disconnection', function(client, reason) {
	console.log(`deleting client ${client.id} from list. reason: ${reason}`);
	delete demo.dynamic[client.id];
});
demoInstance.on('client-change', function(changes, client, commitClientChanges) {
	let {object, property} = OH.evalPath(demo, changes[0].path);

	if(object === demo && ['foo','bar'].includes(property)) {
		//switch between 'foo' and 'bar', and also print who commited the change
		commitClientChanges(false);

		if(property === 'foo') {
			property = 'bar';
		}
		else {
			property = 'foo';
		}
		
		switch(changes[0].type) {
			case 'create':
			case 'update':
				object[property] = changes[0].value;
				break;
			case 'delete':
				delete object[property];
				break;
		}

		demo.last_changer = demo.dynamic[client.id].name;
	} else {
		commitClientChanges();
	}
});

var alterations = [
	() => {
		demo.free_for_all.regular_object.primitive2 = 'a';
		demo.free_for_all.an_array[1] = true;
	},
	() => {
		demo.must_1.open = 'this requires a single permission';
	},
	() => {
		demo.or_34.open = 'this requires authorization over a signle level';
	},
	() => {
		demo.must_and_or.must_1.or_23.must_4[0].or_56 = 7;
		demo.must_and_or.must_1.or_23.must_4[1].or_56 = 8;
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'b';
		demo.free_for_all.an_array.splice(1, 1);
		demo.must_1.must_2 = 'this requires double permissions';
	},
	() => {
		demo.or_34.open = 'this requires authorization over one level';
	},
	() => {
		demo.must_and_or.must_1.or_23.must_4[0].or_56 = 0;
		demo.must_and_or.must_1.or_23.must_4[1].or_56 = 1;
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'c';
		demo.free_for_all.an_array.splice(1, 0, false);
		demo.must_1.open = 'this requires one permission';
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'd';
		delete demo.free_for_all.an_array[1];
		demo.must_1.must_2 = 'this requires two different permissions';
	}
];
if(false) {
var i = 0;
setInterval(() => {
	alterations[i]();
	i++;
	if(i === alterations.length) i = 0;
}, 200);
}