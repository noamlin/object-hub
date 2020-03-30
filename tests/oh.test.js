"use strict"

const Oh = require('../classes/oh/oh.js');
const http = require('http');
const server = http.createServer();
const { prepareObjectForClient } = require('../classes/oh/object-manipulations.js');

var infrastructure = {
	a_number: 1.23,
	a_string: 'some string',
	nested1: {
		nested2: {
			nested3: true
		},
		nested2_alt: [0, [0, 1, ['a']], 2]
	},
	an_arr: [
		0, 1,
		{ a:'a', b:'b', nestedArr: [{c:'c'}] },
		3, 4,
		{ a:'a', b:'b', nestedArr: [{c:'c'}] },
		6, 7
	]
};
var testOH = new Oh('root', server, infrastructure);

test('check OH instance methods', () => {
	expect(typeof testOH.setPermission).toBe('function');
	expect(typeof testOH.setClientPermissions).toBe('function');
});

test('check permissions creation', () => {
	let expectedPermissions = { 'root.a_number': { writes: { '0':true }, reads: { '0':true } } };
	testOH.setPermission('root.a_number', 0, 0);
	expect(testOH._permissions).toEqual(expectedPermissions);

	expectedPermissions['root.nested1.nested2.nested3'] = { writes: { '1':true }, reads: { '2':true, '3':true } };
	testOH.setPermission('root.nested1.nested2.nested3', 1, [2,3]);
	expect(testOH._permissions).toEqual(expectedPermissions);

	expectedPermissions['root.nested1.nested2_alt.#.1'] = { writes: { '1':true }, reads: { '1':true } };
	testOH.setPermission('root.nested1.nested2_alt.#.1', 1, 1);
	expect(testOH._permissions).toEqual(expectedPermissions);

	expectedPermissions['root.an_arr.#.nestedArr'] = { writes: { '0':true }, reads: { '2':true } };
	testOH.setPermission('root.an_arr.#.nestedArr', 0, 2);
	expect(testOH._permissions).toEqual(expectedPermissions);

	expectedPermissions['root.an_arr.5.nestedArr'] = { writes: { '0':true }, reads: { '3':true } };
	testOH.setPermission('root.an_arr.5.nestedArr', 0, 3);
	expect(testOH._permissions).toEqual(expectedPermissions);
});

var rooms = {};
var mockSocket = {
	join: function(name) { rooms[name] = this.OH.id; },
	leave: function(name) { delete rooms[name]; },
	OH: {
		id: 'some_id',
		permissions: {}
	}
};

test('check client permissions creation', () => {
	testOH.setClientPermissions(mockSocket, 1, 1);
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true, '1':true },
		reads: { 'some_id':true, '1':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id', 'level_1':'some_id' });

	testOH.setClientPermissions(mockSocket, [1,2]);
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true, '1':true, '2':true },
		reads: { 'some_id':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id' });

	testOH.setClientPermissions(mockSocket, 'abc', [2,3,'myStr']);
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true, 'abc':true },
		reads: { 'some_id':true, '2':true, '3':true, 'myStr':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id', 'level_2': 'some_id', 'level_3': 'some_id', 'level_myStr': 'some_id' });

	testOH.setClientPermissions(mockSocket, 0);
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true, '0':true },
		reads: { 'some_id':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id' });
});

test('create object for client', () => {
	let obj = prepareObjectForClient.call(testOH, { 'some_id':true });
	//expect(obj).toEqual(infrastructure);
});