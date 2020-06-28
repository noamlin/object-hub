"use strict";

const Client = require('../classes/client/client.js');
const { ClientPermissions } = require('../classes/permissions/permissions.js');
const { defaultBasePermission } = require('../utils/globals.js');
const mocks = require('./mocks.js');
const OH = require('../classes/oh/oh.js');
const handlers = require('../classes/oh/handlers.js');
const { cloneDeep } = require('lodash');

test('1. Instantiate a client', () => {
	let socket = new mocks.Socket(123);
	let client = new Client(socket);

	expect(Client.prototype.isPrototypeOf(client)).toBe(true);
	expect(typeof client.id).toBe('string');
	expect(client.isInitiated).toBe(false);
	expect(client.socket).toEqual(socket);
	expect(ClientPermissions.prototype.isPrototypeOf(client.permissions)).toBe(true);
	expect(typeof client.setPermissions).toBe('function');
	expect(typeof client.updateRooms).toBe('function');
	expect(typeof client.prepareObject).toBe('function');
	expect(typeof client.init).toBe('function');
});

test('2. updateRooms method', () => {
	let socket = new mocks.Socket(123);
	let client = new Client(socket);

	client.updateRooms(); //no diff. client not initiated
	expect(mocks.Socket.rooms).toEqual({});

	client.isInitiated = true;
	client.updateRooms();
	let shouldEqual = {
		level_socket_123: {
			socket_123: true
		}
	};
	shouldEqual['level_'+defaultBasePermission] = { socket_123: true };
	expect(mocks.Socket.rooms).toEqual(shouldEqual);

	client.updateRooms({
		read: {
			removed: ['0', 'socket_123'],
			added: ['custom_room']
		}
	});
	shouldEqual = {
		level_socket_123: {},
		level_custom_room: {
			socket_123: true
		}
	};
	shouldEqual['level_'+defaultBasePermission] = {};
	expect(mocks.Socket.rooms).toEqual(shouldEqual);
});

test('3. setPermissions method', () => {
	mocks.Socket.rooms = {};
	let socket = new mocks.Socket(123);
	let client = new Client(socket);
	client.isInitiated = true;
	client.updateRooms(); //add to default rooms

	client.setPermissions(1, 2);
	expect(mocks.Socket.rooms).toEqual({
		level_0: {
			socket_123: true
		},
		level_socket_123: {
			socket_123: true
		},
		level_1: {
			socket_123: true
		}
	});
	expect(client.permissions.read.has(defaultBasePermission)).toBe(true);
	expect(client.permissions.read.has('socket_123')).toBe(true);
	expect(client.permissions.read.has(1)).toBe(true);
});

test('4. init method', () => {
	let socket = new mocks.Socket(123);
	let client = new Client(socket);
	let proxy = new OH('test', mocks.server, {});
	let instance = OH.getInstance(proxy);
	instance.io = mocks.io;
	
	client.init(instance);
	expect(client.isInitiated).toBe(true);
	expect(instance.clients.has('socket_123')).toBe(true);
	expect(instance.io.lastEmit).toEqual({
		message: 'init',
		to: {
			socket_123: true
		},
		changes: {
			id: 'socket_123',
			obj: {}
		}
	});
});

test('5. prepareObject method', (done) => {
	let anInfrastructure = cloneDeep(mocks.infrastructure);
	let proxy = new OH('test', mocks.server, anInfrastructure);
	let instance = OH.getInstance(proxy);
	let delay = instance.delay + 10;
	instance.io = mocks.io;

	let socket = new mocks.Socket(123);
	let client = new Client(socket);
	handlers.onConnection.call(instance, client); //should trigger event-change for client initiation

	instance.setPermissions('a_number', 1);
	instance.setPermissions('a_string', 0, 0);//on purpose
	instance.setPermissions('nested1.nested2.nested3', [2,3]);
	instance.setPermissions('nested1.nested2_alt[0-2][1]', 1);
	instance.setPermissions('an_arr[0-5].nestedArr', 2);
	instance.setPermissions('an_arr[5].nestedArr', [2,3]);

	client.setPermissions(0, 0);
	
	setTimeout(() => {
		//should init the client by the time we reach here
		expect(instance.io.lastEmit.changes.obj).toEqual({
			a_string: 'some string',
			nested1: {
				nested2: {},
				nested2_alt: [0, [0, undefined, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b' },
				3, 4,
				{ a:'a', b:'b' },
				6, 7
			]
		});
		part2();
	}, delay);

	function part2() {
		client.setPermissions(1);
		let obj = client.prepareObject(cloneDeep(proxy), instance.permissionTree);
		expect(obj).toEqual({
			a_number: 1.23,
			a_string: 'some string',
			nested1: {
				nested2: {},
				nested2_alt: [0, [0, 1, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b' },
				3, 4,
				{ a:'a', b:'b' },
				6, 7
			]
		});
		part3();
	}

	function part3() {
		client.setPermissions(2);
		let obj = client.prepareObject(cloneDeep(proxy), instance.permissionTree);
		expect(obj).toEqual({
			a_string: 'some string',
			nested1: {
				nested2: {
					nested3: true
				},
				nested2_alt: [0, [0, undefined, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		});
		part4();
	}

	function part4() {
		client.setPermissions(3);
		let obj = client.prepareObject(cloneDeep(proxy), instance.permissionTree);
		expect(obj).toEqual({
			a_string: 'some string',
			nested1: {
				nested2: {
					nested3: true
				},
				nested2_alt: [0, [0, undefined, ['a']], 2]
			},
			an_arr: [
				0, 1,
				{ a:'a', b:'b' },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		});
		part5();
	}

	function part5() {
		client.setPermissions([1,3]);
		let obj = client.prepareObject(cloneDeep(proxy), instance.permissionTree);
		expect(obj).toEqual({
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
				{ a:'a', b:'b' },
				3, 4,
				{ a:'a', b:'b', nestedArr: [{c:'c'}] },
				6, 7
			]
		});
		part6();
	}

	function part6() {
		//one crazy sub-property that covers all possible combinations
		let mockProxy = { allCombinations: { obj1: { obj2: {
			arr1: [0,1,2,
				[
					0,
					[{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2',c:'3'}] } }],
					2
				]
			]
		} } } };

		instance.setPermissions('allCombinations.obj1', 4);
		instance.setPermissions('allCombinations.obj1.obj2', 5);
		instance.setPermissions('allCombinations.obj1.obj2.arr1', 6);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[0-3][0]', 7);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][2]', 8);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][1]', 9);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][1][0].obj3', 10);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2', 11);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2[0-2].b', 12);
		instance.setPermissions('allCombinations.obj1.obj2.arr1[3][1][0].obj3.arr2[2].c', 13);

		client.setPermissions(0);
		let obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: {} });

		client.setPermissions(4);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: {} } });

		client.setPermissions([4,5]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: {} } } });

		client.setPermissions([4,5,6]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined,undefined,undefined]] } } } });

		client.setPermissions([4,5,6,7]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, undefined, undefined]] } } } });

		client.setPermissions([4,5,6,7,8]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, undefined, 2]] } } } });

		client.setPermissions([4,5,6,7,8,9]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{}], 2]] } } } });

		client.setPermissions([4,5,6,7,8,9,10]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: {} }], 2]] } } } });

		client.setPermissions([4,5,6,7,8,9,10,11]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',c:'c'}, {a:'x',c:'z'}, {a:'1'}] } }], 2]] } } } });

		client.setPermissions([4,5,6,7,8,9,10,11,12]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2'}] } }], 2]] } } } });

		client.setPermissions([4,5,6,7,8,9,10,11,12,13]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [0, [{ obj3: { arr2: [{a:'a',b:'b',c:'c'}, {a:'x',b:'y',c:'z'}, {a:'1',b:'2',c:'3'}] } }], 2]] } } } });

		client.setPermissions([5,6,7,8,9,10,11,12,13]); //no 4
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: {} });

		client.setPermissions([4,5,6, 9]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], undefined] ] } } } });

		client.setPermissions([4,5,6, 9, 13]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{}], undefined] ] } } } });

		client.setPermissions([4,5,6, 9,10,11, 13]);
		obj = client.prepareObject(cloneDeep(mockProxy), instance.permissionTree);
		expect(obj).toEqual({ allCombinations: { obj1: { obj2: { arr1: [0,1,2, [undefined, [{ obj3: { arr2: [{a:'a',c:'c'}, {a:'x',c:'z'}, {a:'1',c:'3'}] } }], undefined] ] } } } });

		done();
	}
});