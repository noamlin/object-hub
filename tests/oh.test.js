"use strict"

const util = require('util');
const OH = require('../classes/oh/oh.js');
const handlers = require('../classes/oh/handlers.js');
const { realtypeof } = require('../utils/variables.js');
const { cloneDeep } = require('lodash');
const mocks = require('./mocks.js');

//test if proxy's internal [[handler]] is revoked. according to http://www.ecma-international.org/ecma-262/6.0/#sec-proxycreate
function isRevoked(value) {
	try {
		new Proxy(value, value); //instantiating with revoked-proxy throws an error
		return false;
	} catch(err) {
		return Object(value) === value; //check if value was an object at all. only revoked proxy will reach here and return true
	}
}

test('1. Instantiate OH', () => {
	let proxy = new OH('root', mocks.server, cloneDeep(mocks.infrastructure));
	let instance = OH.getInstance(proxy);

	expect(util.types.isProxy(proxy)).toBe(true);
	expect(realtypeof(instance.clients)).toBe('Map');
	expect(realtypeof(instance.pendingClients)).toBe('Map');
	expect(typeof instance.setPermissions).toBe('function');
});

//async
test('2. Destroy an OH instance', (done) => {
	let anInfrastructure = cloneDeep(mocks.infrastructure);
	let proxy = new OH('root', mocks.server, anInfrastructure);
	let instance = OH.getInstance(proxy);

	instance.clients.set('some_id', 'some client');
	instance.pendingClients.set('some_id', 'some client');
	let client1 = new mocks.Client();
	let client2 = new mocks.Client();
	instance.io.connected['client1'] = client1.socket;
	instance.io.connected['client2'] = client2.socket;
	let io = instance.io;
	expect(io.listenerCount('connection')).toBe(1);

	instance.destroy((originalObject) => {
		expect(originalObject === anInfrastructure).toEqual(true);
		expect(instance.clients.size).toBe(0);
		expect(instance.pendingClients.size).toBe(0);
		expect(mocks.Socket.disconnectCount).toBe(2);
		expect(io.listenerCount('connection')).toBe(0);
		setTimeout(() => {
			expect(isRevoked(proxy)).toBe(true); //takes delay+1000 to be destroyed by Proxserve
			done();
		}, instance.delay*2 + 1000);
	});
});

test('3. Create and send changes to client', (done) => {
	let anInfrastructure = cloneDeep(mocks.infrastructure);
	let proxy = new OH('root', mocks.server, anInfrastructure);
	let instance = OH.getInstance(proxy);
	instance.io = mocks.io;
	let delay = instance.delay + 1;

	let client1 = new mocks.Client();
	let client2 = new mocks.Client();
	let client3 = new mocks.Client();
	handlers.onConnection.call(instance, client1);
	handlers.onConnection.call(instance, client2);
	handlers.onConnection.call(instance, client3);

	proxy.nested1.nested2.nested3 = 2;
	setTimeout(() => {
		expect(instance.io.lastEmit).toEqual({
			to: { level_0: true },
			message: 'change',
			changes: [
				{
				  type: 'update',
				  value: 2,
				  oldValue: true,
				  path: '.nested1.nested2.nested3'
				}
			 ]
		});

		//clients also should have been initiated
		expect(instance.pendingClients.size).toBe(0);
		expect(client1.isInitiated).toBe(true);
		expect(client2.isInitiated).toBe(true);
		expect(client3.isInitiated).toBe(true);

		part2();
	}, delay);

	function part2() {
		instance.setPermissions('nested1', 1);
		instance.setPermissions('nested1.nested2', 2);
		instance.setPermissions('nested1.nested2.nested3', 3);
		
		instance.io.lastEmit = null;
		proxy.nested1.nested2.nested3 = 3;

		setTimeout(() => {
			expect(instance.io.lastEmit).toBe(null);
			part3();
		}, delay);
	}

	function part3() {
		client2.setPermissions([1,2,3], 0);
		proxy.nested1.nested2.nested3 = 4;

		setTimeout(() => {
			let shouldBe = {
				to: {},
				message: 'change',
				changes: [
					{
					  type: 'update',
					  value: 4,
					  oldValue: 3,
					  path: '.nested1.nested2.nested3'
					}
				 ]
			};
			shouldBe.to[client2.socket.id] = true;
			expect(instance.io.lastEmit).toEqual(shouldBe);
			part4();
		}, delay);
	}

	function part4() {
		instance.setPermissions('nested1', 0);
		instance.setPermissions('nested1.nested2', 0);
		instance.setPermissions('nested1.nested2.nested3', 3);
		
		proxy.nested1.nested2.nested3 = 5;
		setTimeout(() => {
			let shouldBe = {
				to: { level_3: true },
				message: 'change',
				changes: [
					{
						type: 'update',
						value: 5,
						oldValue: 4,
						path: '.nested1.nested2.nested3'
					}
					]
			};
			expect(instance.io.lastEmit).toEqual(shouldBe);
			done();
		}, delay);
	}
});