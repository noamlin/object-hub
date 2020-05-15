"use strict"

const path = require('path');
const baseDir = path.resolve(__dirname, '../../');
const http = require('http');
const express = require('express');
const app = express();
const OH = require(`${baseDir}/index.js`);
const { isNumeric } = require(`${baseDir}/utils/general.js`);

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
	must: {
		one: 'this requires one permission',
		two: 'this requires two different permissions'
	},
	or: {
		one: 'this requires authorization over one level',
		two: 'this requires authorization over two different levels'
	},
	must_and_or: {
		must: {
			or: {
				must: [
					{ or: 0 },
					{ or: 1 },
					{ or: 2 }
				]
			}
		},
		or: {
			must: {
				or: [
					{ must: 0 },
					{ must: 1 },
					{ must: 2 }
				]
			}
		}
	},
	dynamic: {}
};

var demo = new OH('demo', server, infrastructure);

OH.use(demo).setPermissions('', 9, 0);
OH.use(demo).setPermissions('must', 1, 1);
OH.use(demo).setPermissions('must.two', 2, 2);
OH.use(demo).setPermissions('or', [2,3,4], [3,4]);
OH.use(demo).setPermissions('or.two', [3,4,'admin'], 4);
OH.use(demo).setPermissions('must_and_or', null, null);
OH.use(demo).setPermissions('must_and_or.must', 1, 1);
OH.use(demo).setPermissions('must_and_or.must.or', [2,3]);
OH.use(demo).setPermissions('must_and_or.must.or.must', 4);
OH.use(demo).setPermissions('must_and_or.must.or.must[0-1].or', [5,6]);
OH.use(demo).setPermissions('must_and_or.must.or.must[2].or', [7,8]);
OH.use(demo).setPermissions('must_and_or.or', [1,2], [1,2]);
OH.use(demo).setPermissions('must_and_or.or.must', 3);
OH.use(demo).setPermissions('must_and_or.or.must.or', [4,5]);
OH.use(demo).setPermissions('must_and_or.or.must.or[1-2].must', 6, 6);
OH.use(demo).setPermissions('must_and_or.or.must.or[0].must', 7, 7);

OH.use(demo).on('connection', function(client, clientData, init) {
	if(clientData) {
		let id = client.id;
		this.setPermissions(`demo.dynamic.${id}.secret`, id, id); //only client himself can read/write this secret
	
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

	init();
});
OH.use(demo).on('disconnection', function(client, reason) {
	console.log(`deleting client from list because of: ${reason}`);
	delete demo.dynamic[client.id];
});
OH.use(demo).on('client-change', function(changes, client, commitClientChanges) {
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

var loopCount = 0;
setInterval(() => {
	switch(loopCount) {
		case 0:
			demo.free_for_all.regular_object.primitive2 = 'a';
			demo.free_for_all.an_array[1] = true;
			break;
		case 1:
			demo.free_for_all.regular_object.primitive2 = 'b';
			demo.free_for_all.an_array.splice(1, 1);
			break;
		case 2:
			demo.free_for_all.regular_object.primitive2 = 'c';
			demo.free_for_all.an_array.splice(1, 0, false);
			break;
		case 3:
			demo.free_for_all.regular_object.primitive2 = 'd';
			delete demo.free_for_all.an_array[1];
			break;
	}
	
	loopCount = (loopCount > 3) ? 0 : loopCount+1;
}, 500);