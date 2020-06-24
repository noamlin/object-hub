"use strict";

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
	expect(MockSocket.rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, [1,2]);
	permissionsShouldEqual.writes['2'] = true;
	delete permissionsShouldEqual.reads['1'];
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	delete roomsShouldEqual.level_1[id]; //should be left an empty room since last test
	expect(MockSocket.rooms).toEqual(roomsShouldEqual);

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
	expect(MockSocket.rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, 0); //omitting reads
	permissionsShouldEqual = { writes: {}, reads: {} };
	permissionsShouldEqual.writes[id] = true;
	permissionsShouldEqual.reads[id] = true;
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);

	roomsShouldEqual = { level_0: {}, level_1: {}, level_2: {}, level_3: {}, level_myStr: {} };
	roomsShouldEqual['level_'+id] = {};
	roomsShouldEqual['level_0'][id] = true;
	roomsShouldEqual['level_'+id][id] = true;
	expect(MockSocket.rooms).toEqual(roomsShouldEqual);

	testOH.setClientPermissions(mockSocket, 0, 0); //reads as 0
	expect(mockSocket.OH.permissions).toEqual(permissionsShouldEqual);
	expect(MockSocket.rooms).toEqual(roomsShouldEqual);
});