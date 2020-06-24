"use strict";

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