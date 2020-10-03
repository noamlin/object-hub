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
			not_primitive3: { x: 'yz'}
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
demoInstance.setPermissions('must_1', 1, 1); //read: 1 , write: 1
demoInstance.setPermissions('must_1.must_2', 2, 2); //read: 1 & 2 , write: 2
demoInstance.setPermissions('or_34', [3,4], [3,4]); //read: [3,4] , write: [3,4]
demoInstance.setPermissions('or_34.or_12', [1,2], 4); //read: [3,4] & [1,2] , write: 4
demoInstance.setPermissions('must_and_or', null, null); //read: 0 , write: 0
demoInstance.setPermissions('must_and_or.must_1', 1, 1); //read: 1 , write: 1
demoInstance.setPermissions('must_and_or.must_1.or_23', [2,3], [2,3]); //read: 1 & [2,3] , write: [2,3]
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4', 4, 4); //read: 1 & [2,3] & 4 , write: 4
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4[0-1].or_56', [5,6]); //read: 1 & [2,3] & 4 & [5,6] , write: 4
demoInstance.setPermissions('must_and_or.must_1.or_23.must_4[2].or_78', [7,8]); //read: 1 & [2,3] & 4 & [7,8] , write: 4
demoInstance.setPermissions('must_and_or.or_12', [1,2], [1,2]); //read: [1,2] , write: [1,2]
demoInstance.setPermissions('must_and_or.or_12.must_3', 3, 3); //read: [1,2] & 3 , write: 3
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45', [4,5]); //read: [1,2] & 3 & [4,5] , write: 3
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45[1-2].must_6', 6, 6); //read: [1,2] & 3 & [4,5] & 6 , write: 6
demoInstance.setPermissions('must_and_or.or_12.must_3.or_45[0].must_7', 7, 7); //read: [1,2] & 3 & [4,5] & 7 , write: 7

demoInstance.once('connection', function() {
	beginRandomDataManipulation(400);
});
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
demoInstance.on('client-change', function(changes, client, commitChange) {
	for(let change of changes) {
		let object, property;
		try {
			({object, property} = OH.evalPath(demo, change.path));
		} catch(err) {
			console.warn(`Client tried to alter a path not yet existing (or deleted). this happens when client is not in sync`);
			continue;
		}

		if(object === demo && ['foo','bar'].includes(property)) {
			//switch between 'foo' and 'bar', and also print who commited the change
			commitChange(change, false);
	
			if(property === 'foo') {
				property = 'bar';
			}
			else {
				property = 'foo';
			}
			
			switch(change.type) {
				case 'create':
				case 'update':
					object[property] = change.value;
					break;
				case 'delete':
					delete object[property];
					break;
			}
	
			demo.last_changer = demo.dynamic[client.id].name;
		}
		else {
			commitChange(change);
		}
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
		demo.must_and_or.must_1.or_23.must_4[0].or_56 = 77;
		demo.must_and_or.must_1.or_23.must_4[2].or_78 = 88;
	},
	() => {
		demo.free_for_all.regular_object.not_primitive3 = ['txt', {b: ['z']}];
	},
	() => {
		demo.must_and_or.or_12.must_3.or_45[0].must_7 = 55;
		demo.must_and_or.or_12.must_3.or_45[1].must_6 = 66;
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'b';
		demo.free_for_all.an_array.splice(1, 1);
		demo.must_1.must_2 = 'this requires double permissions';
	},
	() => {
		demo.or_34.or_12 = 'this requires 2 levels with different authorization';
	},
	() => {
		demo.must_and_or.must_1.or_23.must_4[0].or_56 = 0;
		demo.must_and_or.must_1.or_23.must_4[2].or_78 = 1;
	},
	() => {
		demo.or_34.open = 'this requires authorization over 1 level';
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'c';
		demo.free_for_all.an_array.splice(1, 0, false);
		demo.must_1.open = 'this requires one permission';
		demo.or_34.or_12 = 'this is here just for some scrambling';
		demo.free_for_all.regular_object.not_primitive3 = {x: 'yz'};
	},
	() => {
		demo.must_and_or.or_12.must_3.or_45[0].must_7 = 0;
		demo.must_and_or.or_12.must_3.or_45[1].must_6 = 1;
	},
	() => {
		demo.free_for_all.regular_object.primitive2 = 'd';
		delete demo.free_for_all.an_array[1];
		demo.must_1.must_2 = 'this requires two different permissions';
	},
	() => {
		demo.or_34.or_12 = 'this requires authorization over two different levels';
	}
];

var i = 0;
function beginRandomDataManipulation(delay) {
	setInterval(() => {
		try {
			alterations[i]();
		} catch(error) {
			console.error(error);
		}
		i++;
		if(i === alterations.length) i = 0;
	}, delay);
}