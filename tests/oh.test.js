"use strict"

const Oh = require('../classes/oh/oh.js');
const { prepareObjectForClient } = require('../classes/oh/object-manipulations.js');
//const { cloneDeep } = require('lodash');

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

var testOH;

test('instantiate OH', () => {
	testOH = new Oh('root', undefined, infrastructure);

	expect(typeof testOH.clients).toBe('object');
	expect(typeof testOH.root).toBe('object');
	expect(typeof testOH.setPermission).toBe('function');
	expect(typeof testOH.setClientPermissions).toBe('function');
});

test('check permissions creation', () => {
	let expectedPermissions = { 'root': {'a_number': { __writes: {}, __reads: {} } } };
	testOH.setPermission('root.a_number', 0, 0);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1'] = {'nested2': { __writes: { '4':true }, __reads: { '4':true } } };
	testOH.setPermission('root.nested1.nested2', 4, 4);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1']['nested2']['nested3'] = { __writes: { '3':true, '4':true, '5':true }, __reads: { '6':true, '7':true , '8':true } };
	testOH.setPermission('root.nested1.nested2.nested3', [0,3,4,5], [0,6,7,8]);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	//overwriting an existing permission
	expectedPermissions['root']['nested1']['nested2']['nested3'] = { __writes: { '1':true }, __reads: { '2':true, '3':true } };
	testOH.setPermission('root.nested1.nested2.nested3', 1, [2,3]);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1']['nested2_alt'] = {'#': {'1': { __writes: { '1':true }, __reads: { '1':true } } } };
	testOH.setPermission('root.nested1.nested2_alt.#.1', 1, 1);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['an_arr'] = {'#': {'nestedArr': { __writes: {}, __reads: { '2':true } } } };
	testOH.setPermission('root.an_arr.#.nestedArr', 0, 2);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['an_arr']['5'] = {'nestedArr': { __writes: {}, __reads: { '3':true } } };
	testOH.setPermission('root.an_arr.5.nestedArr', 0, 3);
	expect(testOH.__permissions).toEqual(expectedPermissions);
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

	testOH.setClientPermissions(mockSocket, 0); //omitting reads
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true },
		reads: { 'some_id':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id' });

	testOH.setClientPermissions(mockSocket, 0, 0); //reads as 0
	expect(mockSocket.OH.permissions).toEqual({
		writes: { 'some_id':true },
		reads: { 'some_id':true }
	});
	expect(rooms).toEqual({ 'level_some_id':'some_id' });
});

test('create object for client', (done) => {
	testOH = new Oh('root', undefined, infrastructure);

	testOH.setPermission('root.a_number', 0, 1);
	testOH.setPermission('root.a_string', 0, 0);//on purpose
	testOH.setPermission('root.nested1.nested2.nested3', 0, [2,3]);
	testOH.setPermission('root.nested1.nested2_alt.#.1', 0, 1);
	testOH.setPermission('root.an_arr.#.nestedArr', 0, 2);
	testOH.setPermission('root.an_arr.5.nestedArr', 0, 3);
	
	testOH.setClientPermissions(mockSocket, 0);
	let obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
	
	expect(obj).toEqual({
		root: {
			a_string: 'some string',
			nested1: {
				nested2: {/*deleted*/},
				nested2_alt: [0, [0, undefined/*deleted*/, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', /*deleted*/ },
				3, 4,
				{ a:'a', b:'b', /*deleted*/ },
				6, 7
			]
		}
	});

	testOH.setClientPermissions(mockSocket, 0, 1);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);

	expect(obj).toEqual({
		root: {
			a_number: 1.23,
			a_string: 'some string',
			nested1: {
				nested2: {/*deleted*/},
				nested2_alt: [0, [0, 1, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', /*deleted*/ },
				3, 4,
				{ a:'a', b:'b', /*deleted*/ },
				6, 7
			]
		}
	});

	testOH.setClientPermissions(mockSocket, 0, 2);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);

	expect(obj).toEqual({
		root: {
			a_string: 'some string',
			nested1: {
				nested2: { nested3: true },
				nested2_alt: [0, [0, undefined/*deleted*/, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		}
	});
	
	testOH.setClientPermissions(mockSocket, 0, 3);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);

	expect(obj).toEqual({
		root: {
			a_string: 'some string',
			nested1: {
				nested2: { nested3: true },
				nested2_alt: [0, [0, undefined/*deleted*/, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', /*deleted*/ },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		}
	});
	
	testOH.setClientPermissions(mockSocket, 0, [1,3]);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);

	expect(obj).toEqual({
		root: {
			a_number: 1.23,
			a_string: 'some string',
			nested1: {
				nested2: { nested3: true },
				nested2_alt: [0, [0, 1, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', /*deleted*/ },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		}
	});
	
	//one crazy sub-property that covers all possible combinations
	delete testOH.root.a_number;
	delete testOH.root.a_string;
	delete testOH.root.nested1;
	delete testOH.root.an_arr;
	testOH.root.allCombinations = { obj1: { obj2: {
		arr1: [0,1,2,
			[
				0,
				[{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2',c:'3'}] } }],
				2
			]
		]
	} } };
	
	testOH.setPermission('root.allCombinations.obj1', 0, 4);
	testOH.setPermission('root.allCombinations.obj1.obj2', 0, 5);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1', 0, 6);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.1', 0, 7);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.#.2', 0, 8);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.#', 0, 9);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.1.#.obj3', 0, 10);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.1.#.obj3.arr2', 0, 11);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.1.#.obj3.arr2.#.b', 0, 12);
	testOH.setPermission('root.allCombinations.obj1.obj2.arr1.3.1.#.obj3.arr2.2.c', 0, 13);

	setTimeout(() => {
		testOH.setClientPermissions(mockSocket, 0, 0);
		let obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: {} } });
	
		testOH.setClientPermissions(mockSocket, 0, 4);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: {} } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: {} } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2,[undefined,undefined,undefined]] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], undefined] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8,9]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{}], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8,9,10]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: {} }], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8,9,10,11]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',c:'c'}, {a:'x',c:'z'}, {a:'1'}] } }], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8,9,10,11,12]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2'}] } }], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8,9,10,11,12,13]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2',c:'3'}] } }], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [5,6,7,8,9,10,11,12,13]); //no 4
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: {} } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6, 9]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{}], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6, 9, 13]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{}], 2] ] } } } } });
	
		testOH.setClientPermissions(mockSocket, 0, [4,5,6, 9,10,11, 13]);
		obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
		expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',c:'c'}, {a:'x',c:'z'}, {a:'1',c:'3'}] } }], 2] ] } } } } });

		done();
	}, 2500);//waiting more than 2000ms for observable-slim internal timeout for cleaning orphanded proxies
});

//async
test('destroy an OH instance', (done) => {
	testOH.destroy((originalObject) => {
		expect(originalObject).toEqual(infrastructure);
		expect(typeof testOH.clients).toBe('undefined');
		expect(typeof testOH.root).toBe('undefined');
		expect(typeof testOH.__rootPath).toBe('undefined');
		expect(typeof testOH.__permissions).toBe('undefined');
		expect(typeof testOH.__io).toBe('undefined');
		done();
	});
});