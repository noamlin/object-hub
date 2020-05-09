"use strict"

const Oh = require('../classes/oh/oh.js');
const handlers = require('../classes/oh/handlers.js');
const { prepareObjectForClient } = require('../classes/oh/object-manipulations.js');
const { realtypeof } = require('../utils/general.js');
const { cloneDeep } = require('lodash');

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

var rooms = {};

class MockSocket {
	constructor() {
		this.id = 'id' + Math.floor(Math.random()*10000);
		this.handshake = { query: '' };
	}
	join(name) {
		if(!rooms[name]) {
			rooms[name] = {};
		}
		rooms[name][this.OH.id] = true;
	}
	leave(name) {
		delete rooms[name][this.OH.id];
	}
};

var mockIO = {
	rooms: {},
	lastEmit: null,
	to: function(room) {
		this.rooms[room] = true;
		return this;
	},
	on: function(args) { console.log('on', args); },
	emit: function(message, data) {
		this.lastEmit = { to: this.rooms, message: message, changes: data };
		this.rooms = {};
	}
};

test('1. Instantiate OH', () => {
	let testOH = new Oh('root', undefined, cloneDeep(infrastructure));

	expect(realtypeof(testOH.clients)).toBe('Map');
	expect(typeof testOH.root).toBe('object');
	expect(typeof testOH.setPermissions).toBe('function');
	expect(typeof testOH.setClientPermissions).toBe('function');
});

test('2. Check permissions creation', () => {
	let testOH = new Oh('root', undefined, cloneDeep(infrastructure));

	let expectedPermissions = {
		'root': {
			'a_number': {}
		}
	};
	testOH.setPermissions('root.a_number', 0, 0, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1'] = {
		'nested2': {
			__writes: { '4': true },
			__reads: { '4': true },
			__compiled: {
				writes: { must: ['4'], or: [] },
				reads: { must: ['4'], or: [] }
			}
		}
	};
	testOH.setPermissions('root.nested1.nested2', 4, 4, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1']['nested2']['nested3'] = {
		__writes: { '3': true, '4': true, '5': true },
		__reads: { '6': true, '7': true, '8': true },
		__compiled: {
			writes: { must: ['4'], or: [] },
			reads: { must: ['4'], or: [['6','7','8']] }
		}
	};
	testOH.setPermissions('root.nested1.nested2.nested3', [0,3,4,5], [0,6,7,8], true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	// //overwriting an existing permission
	expectedPermissions['root']['nested1']['nested2']['nested3'] = {
		__writes: { '1': true, '3': true },
		__reads: { '2': true, '3': true },
		__compiled: {
			writes: { must: ['4'], or: [['1','3']] },
			reads: { must: ['4'], or: [['2','3']] }
		}
	};
	testOH.setPermissions('root.nested1.nested2.nested3', [1,3], [2,3], true);
	expect(testOH.__permissions).toEqual(expectedPermissions);
	
	expectedPermissions['root']['nested1']['nested2'] = {
		__writes: { '4': true, '5': true, '6': true },
		__compiled: {
			writes: { must: [], or: [['4','5','6']] },
			reads: { must: [], or: [] }
		},
		'nested3': {
			__writes: { '1': true, '3': true },
			__reads: { '2': true, '3': true },
			__compiled: {
				writes: { must: [], or: [['4','5','6'], ['1','3']] },
				reads: { must: [], or: [['2','3']] }
			}
		}
	};
	testOH.setPermissions('root.nested1.nested2', [4,5,6], 0, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['nested1']['nested2_alt'] = {
		'0': {
			'1': {
				__writes: { '1': true },
				__reads: { '1': true },
				__compiled: {
					writes: { must: ['1'], or: [] },
					reads: { must: ['1'], or: [] }
				}
			}
		},
		'1': {
			'1': {
				__writes: { '1': true },
				__reads: { '1': true },
				__compiled: {
					writes: { must: ['1'], or: [] },
					reads: { must: ['1'], or: [] }
				}
			}
		}
	};
	testOH.setPermissions('root.nested1.nested2_alt[0-1][1]', 1, 1, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['an_arr'] = {
		'3': {
			'nestedArr': {
				__reads: { '6': true, '7': true },
				__compiled: {
					writes: { must: [], or: [] },
					reads: { must: [], or: [['6','7']] }
				}
			}
		},
		'4': {
			'nestedArr': {
				__reads: { '6': true, '7': true },
				__compiled: {
					writes: { must: [], or: [] },
					reads: { must: [], or: [['6','7']] }
				}
			}
		}
	};
	testOH.setPermissions('root.an_arr[4-3].nestedArr', 0, [6,7], true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	expectedPermissions['root']['an_arr']['3']['nestedArr'] = {
		__reads: { '3': true },
		__compiled: {
			writes: { must: [], or: [] },
			reads: { must: ['3'], or: [] }
		}
	};
	testOH.setPermissions('root.an_arr[3].nestedArr', 0, 3, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);

	//test recursion of updating child objects of assigned object
	expectedPermissions['root']['an_arr'] = {
		__reads: { '6': true },
		__compiled: {
			writes: { must: [], or: [] },
			reads: { must: ['6'], or: [] }
		},
		'3': {
			'nestedArr': {
				__reads: { '3': true },
				__compiled: {
					writes: { must: [], or: [] },
					reads: { must: ['6','3'], or: [] }
				}
			}
		},
		'4': {
			'nestedArr': {
				__reads: { '6': true, '7': true },
				__compiled: {
					writes: { must: [], or: [] },
					reads: { must: ['6'], or: [] }
				}
			}
		}
	};
	testOH.setPermissions('root.an_arr', 0, 6, true);
	expect(testOH.__permissions).toEqual(expectedPermissions);
});

test('3. Check client permissions creation', () => {
	let testOH = new Oh('root', undefined, cloneDeep(infrastructure));
	let mockSocket = new MockSocket();
	handlers.onConnection.call(testOH, mockSocket); //joins room level_0
	let id = mockSocket.OH.id;

	testOH.setClientPermissions(mockSocket, 1, 1);
	let permissionsShouldEqual = { writes: { '1':true }, reads: { '1':true } };
	permissionsShouldEqual.writes[id] = true;
	permissionsShouldEqual.reads[id] = true;
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	let roomsShouldEqual = { level_0: {}, level_1: {} };
	roomsShouldEqual['level_'+id] = {};
	for(let key of Object.keys(roomsShouldEqual)) {
		roomsShouldEqual[key][id] = true;
	}
	expect(rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, [1,2]);
	permissionsShouldEqual.writes['2'] = true;
	delete permissionsShouldEqual.reads['1'];
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	delete roomsShouldEqual.level_1[id]; //should be left an empty room since last test
	expect(rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, 'abc', [2,3,'myStr']);
	permissionsShouldEqual = { writes: { 'abc':true }, reads: { '2':true, '3':true, 'myStr':true } };
	permissionsShouldEqual.writes[id] = true;
	permissionsShouldEqual.reads[id] = true;
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	roomsShouldEqual.level_2 = {};
	roomsShouldEqual.level_2[id] = true;
	roomsShouldEqual.level_3 = {};
	roomsShouldEqual.level_3[id] = true;
	roomsShouldEqual.level_myStr = {};
	roomsShouldEqual.level_myStr[id] = true;
	expect(rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, 0); //omitting reads
	permissionsShouldEqual = { writes: {}, reads: {} };
	permissionsShouldEqual.writes[id] = true;
	permissionsShouldEqual.reads[id] = true;
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	roomsShouldEqual = { level_0: {}, level_1: {}, level_2: {}, level_3: {}, level_myStr: {} };
	roomsShouldEqual['level_'+id] = {};
	roomsShouldEqual['level_0'][id] = true;
	roomsShouldEqual['level_'+id][id] = true;
	expect(rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, 0, 0); //reads as 0
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);
	expect(rooms).toEqual(roomsShouldEqual);
});

test('4. Create object for client', () => {
	let testOH = new Oh('root', undefined, cloneDeep(infrastructure));
	let mockSocket = new MockSocket();
	handlers.onConnection.call(testOH, mockSocket);

	testOH.setPermissions('root.a_number', 0, 1);
	testOH.setPermissions('root.a_string', 0, 0);//on purpose
	testOH.setPermissions('root.nested1.nested2.nested3', 0, [2,3]);
	testOH.setPermissions('root.nested1.nested2_alt[0-2][1]', 0, 1);
	testOH.setPermissions('root.an_arr[0-5].nestedArr', 0, 2);
	testOH.setPermissions('root.an_arr[5].nestedArr', 0, [2,3]);

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
	
	testOH.setPermissions('root.allCombinations.obj1', 0, 4);
	testOH.setPermissions('root.allCombinations.obj1.obj2', 0, 5);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1', 0, 6);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[0-3][0]', 0, 7);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][2]', 0, 8);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][1]', 0, 9);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][1][0].obj3', 0, 10);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2', 0, 11);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2[0-2].b', 0, 12);
	testOH.setPermissions('root.allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2[2].c', 0, 13);

	testOH.setClientPermissions(mockSocket, 0, 0);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
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
	expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, undefined, undefined] ] } } } } });

	testOH.setClientPermissions(mockSocket, 0, [4,5,6,7,8]);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
	expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, undefined, 2] ] } } } } });

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
	expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], undefined] ] } } } } });

	testOH.setClientPermissions(mockSocket, 0, [4,5,6, 9, 13]);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
	expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], undefined] ] } } } } });

	testOH.setClientPermissions(mockSocket, 0, [4,5,6, 9,10,11, 13]);
	obj = prepareObjectForClient.call(testOH, mockSocket.OH.permissions.reads);
	expect(obj).toEqual({ root: { allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{ obj3: { arr2: [{a:'a',c:'c'}, {a:'x',c:'z'}, {a:'1',c:'3'}] } }], undefined] ] } } } } });
});

//async
test('5. Destroy an OH instance', (done) => {
	let anInfrastructure = cloneDeep(infrastructure);
	let testOH = new Oh('root', undefined, anInfrastructure);

	testOH.destroy((originalObject) => {
		expect(originalObject === anInfrastructure).toEqual(true);
		expect(typeof testOH.clients).toBe('undefined');
		expect(typeof testOH.root).toBe('undefined');
		expect(typeof testOH.__rootPath).toBe('undefined');
		expect(typeof testOH.__permissions).toBe('undefined');
		expect(typeof testOH.__io).toBe('undefined');
		done();
	});
});

test('6. Create and send changes to client', (done) => {
	let delay = 20;
	let testOH = new Oh('root', undefined, cloneDeep(infrastructure));
	testOH.__io = mockIO;

	let mockSocket = new MockSocket();
	let mockSocket2 = new MockSocket();
	let mockSocket3 = new MockSocket();
	handlers.onConnection.call(testOH, mockSocket);
	handlers.onConnection.call(testOH, mockSocket2);
	handlers.onConnection.call(testOH, mockSocket3);
	testOH.setClientPermissions(mockSocket, 0, 0);
	testOH.setClientPermissions(mockSocket2, 0, 0);
	testOH.setClientPermissions(mockSocket3, 0, 0);

	testOH.root.nested1.nested2.nested3 = 2;
	setTimeout(() => {
		expect(testOH.__io.lastEmit).toEqual({
			to: { level_0: true },
			message: 'change',
			changes: [
				{
				  type: 'update',
				  value: 2,
				  oldValue: true,
				  path: 'root.nested1.nested2.nested3'
				}
			 ]
		});

		part2();
	}, delay);

	function part2() {
		testOH.setPermissions('root.nested1', 0, 1);
		testOH.setPermissions('root.nested1.nested2', 0, 2);
		testOH.setPermissions('root.nested1.nested2.nested3', 0, 3);
		testOH.__io.lastEmit = null;
		testOH.root.nested1.nested2.nested3 = 3;

		setTimeout(() => {
			expect(testOH.__io.lastEmit).toEqual(null);
			part3();
		}, delay);
	}

	function part3() {
		testOH.setClientPermissions(mockSocket, 0, [1,2,3]);
		testOH.root.nested1.nested2.nested3 = 4;
		setTimeout(() => {
			let shouldBe = {
				to: {},
				message: 'change',
				changes: [
					{
						type: 'update',
						value: 4,
						oldValue: 3,
						path: 'root.nested1.nested2.nested3'
					}
					]
			};
			shouldBe.to[mockSocket.OH.id] = true; //should send to only one room, which is our client's ID
			expect(testOH.__io.lastEmit).toEqual(shouldBe);
			part4();
		}, delay);
	}

	function part4() {
		testOH.setClientPermissions(mockSocket, 0, [1,2]); //not enough
		testOH.setClientPermissions(mockSocket2, 0, [2,3]); //not enough
		testOH.setClientPermissions(mockSocket3, 0, [1,2,3]); //enough
		testOH.root.nested1.nested2.nested3 = 5;
		setTimeout(() => {
			let shouldBe = {
				to: {},
				message: 'change',
				changes: [
					{
						type: 'update',
						value: 5,
						oldValue: 4,
						path: 'root.nested1.nested2.nested3'
					}
					]
			};
			shouldBe.to[mockSocket3.OH.id] = true; //should send to only one room, which is our client's ID
			expect(testOH.__io.lastEmit).toEqual(shouldBe);
			done();
		}, delay);
	}
});