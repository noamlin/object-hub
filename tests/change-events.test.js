"use strict"

const { splitPath, evalPath, areValidChanges, digest } = require('../utils/change-events.js');
const OH = require('../classes/oh/oh.js');
const { forceEventChangeKey } = require('../utils/globals.js');
const { infrastructure, MockSocket, mockIO } = require('./mocks.js');
const { cloneDeep } = require('lodash');

test('splitPath method', () => {
	expect(splitPath('')).toEqual([]);
	expect(splitPath('ab.cd.ef')).toEqual(['ab','cd','ef']);
	expect(splitPath('ab.cd[1].ef[2][3]')).toEqual(['ab','cd','1','ef','2','3']);
});

test('evalPath method', () => {
	let obj = {
		aa: {
			bb: {
				cc: 123
			}
		}
	};
	expect(evalPath(obj, 'aa.bb.cc')).toEqual({ object: { cc:123 }, property: 'cc', value: 123 });
	expect(evalPath(obj, 'aa.bb')).toEqual({ object: { bb: { cc:123 } }, property: 'bb', value: {cc:123} });
	expect(evalPath(obj, 'aa')).toEqual({ object: obj, property: 'aa', value: {bb:{cc:123}} });
	expect(evalPath(obj, '')).toEqual({ object: obj, property: undefined, value: obj });

	obj.dd = {
		ee: [
			0, [0, ['a','b','c'], 2], 2
		]
	};
	expect(evalPath(obj, 'dd.ee[1][1][2]')).toEqual({ object: ['a','b','c'], property: '2', value: 'c' });
	expect(evalPath(obj, 'dd.ee[1][1]')).toEqual({ object: [0, ['a','b','c'], 2], property: '1', value: ['a','b','c'] });
});

test('areValidChanges method', () => {
	let changes = []; //empty
	expect(areValidChanges(changes)).toBe(false);

	//fully verbose
	changes.push({ path: '.some1', type: 'create', value: 123, oldValue: -10 });
	changes.push({ path: '.some2', type: 'delete', value: undefined, oldValue: -20 });
	changes.push({ path: '.some3', type: 'update', value: 789, oldValue: -30 });
	expect(areValidChanges(changes)).toBe(true);

	//minimum required properties
	changes.push({ path: '', type: 'create', value: 123 });
	changes.push({ path: '.', type: 'delete', oldValue: -20 });
	expect(areValidChanges(changes)).toBe(true);

	//missing value
	changes.push({ path: '.some', type: 'create', oldValue: 123 });
	expect(areValidChanges(changes)).toBe(false);

	//missing oldValue
	changes[changes.length-1] = { path: '.some', type: 'delete', value: undefined };
	expect(areValidChanges(changes)).toBe(false);

	//missing value
	changes[changes.length-1] = { path: '.some', type: 'update', oldValue: 87 };
	expect(areValidChanges(changes)).toBe(false);

	//missing oldValue
	changes[changes.length-1] = { path: '.some', type: 'update', value: 76 };
	expect(areValidChanges(changes)).toBe(false);
});

test('digest changes method', () => {
	let proxy = new OH('test', mockIO, infrastructure);
	let instance = OH.getInstance(proxy);

	//test regular spreading changes
	let changes = [
		{ path: '.dynamic.abc', oldValue: undefined, type: 'create', value: { a: 'a-value', b: 'b-value' } },
		{ path: '.dynamic.xyz', oldValue: undefined, type: 'create', value: [0, 1, 2] }
	];

	let shouldBe = [
		{ path: '.dynamic.abc', oldValue: undefined, type: 'create', value: {} },
		{ path: '.dynamic.abc.a', oldValue: undefined, type: 'create', value: 'a-value' },
		{ path: '.dynamic.abc.b', oldValue: undefined, type: 'create', value: 'b-value' },
		{ path: '.dynamic.xyz', oldValue: undefined, type: 'create', value: [] },
		{ path: '.dynamic.xyz[0]', oldValue: undefined, type: 'create', value: 0 },
		{ path: '.dynamic.xyz[1]', oldValue: undefined, type: 'create', value: 1 },
		{ path: '.dynamic.xyz[2]', oldValue: undefined, type: 'create', value: 2 }
	];

	let digestedChanges = digest(changes, instance);
	expect(digestedChanges.filteredChanges).toEqual(changes);
	expect(digestedChanges.spreadedChanges).toEqual(shouldBe);
	expect(digestedChanges.requiresDifferentPermissions).toBe(false);

	//test filtering system properties
	changes.push({ path: `.${forceEventChangeKey}`, oldValue: 1, type: 'delete', value: undefined });
	let shouldBeFiltered = cloneDeep(changes);
	shouldBeFiltered.pop();

	digestedChanges = digest(changes, instance);
	expect(digestedChanges.filteredChanges).toEqual(shouldBeFiltered);
	expect(digestedChanges.spreadedChanges).toEqual(shouldBe);
	expect(digestedChanges.requiresDifferentPermissions).toBe(false);

	//test heavy spreading with different permissions
	changes = [
		{ path: '.dynamic.abc', oldValue: undefined, type: 'create', value: 'primitive one' },
		{ path: '.dynamic.xyz', oldValue: undefined, type: 'create', value: { a:'a', b: [0, { one: 1 }, 2], c:'c' } },
		{ path: '.dynamic.dsf', oldValue: undefined, type: 'create', value: 'primitive two' },
		{ path: `.${forceEventChangeKey}`, oldValue: undefined, type: 'create', value: 1 },
		{ path: '.dynamic.mno', oldValue: undefined, type: 'create', value: [0, { a:'a', arr: [13,6], c:'c' }, 2] },
		{ path: '.dynamic.jtr', oldValue: undefined, type: 'create', value: 'primitive three' }
	];

	shouldBeFiltered = cloneDeep(changes);
	shouldBeFiltered.splice(3,1);
	shouldBe = [
		{ path: '.dynamic.abc', oldValue: undefined, type: 'create', value: 'primitive one' },
		{ path: '.dynamic.xyz', oldValue: undefined, type: 'create', value: {} },
		{ path: '.dynamic.xyz.a', oldValue: undefined, type: 'create', value: 'a' },
		{ path: '.dynamic.xyz.b', oldValue: undefined, type: 'create', value: [] },
		{ path: '.dynamic.xyz.b[0]', oldValue: undefined, type: 'create', value: 0 },
		{ path: '.dynamic.xyz.b[1]', oldValue: undefined, type: 'create', value: {} },
		{ path: '.dynamic.xyz.b[1].one', oldValue: undefined, type: 'create', value: 1 },
		{ path: '.dynamic.xyz.b[2]', oldValue: undefined, type: 'create', value: 2 },
		{ path: '.dynamic.xyz.c', oldValue: undefined, type: 'create', value: 'c' },
		{ path: '.dynamic.dsf', oldValue: undefined, type: 'create', value: 'primitive two' },
		{ path: '.dynamic.mno', oldValue: undefined, type: 'create', value: [] },
		{ path: '.dynamic.mno[0]', oldValue: undefined, type: 'create', value: 0 },
		{ path: '.dynamic.mno[1]', oldValue: undefined, type: 'create', value: {} },
		{ path: '.dynamic.mno[1].a', oldValue: undefined, type: 'create', value: 'a' },
		{ path: '.dynamic.mno[1].arr', oldValue: undefined, type: 'create', value: [] },
		{ path: '.dynamic.mno[1].arr[0]', oldValue: undefined, type: 'create', value: 13 },
		{ path: '.dynamic.mno[1].arr[1]', oldValue: undefined, type: 'create', value: 6 },
		{ path: '.dynamic.mno[1].c', oldValue: undefined, type: 'create', value: 'c' },
		{ path: '.dynamic.mno[2]', oldValue: undefined, type: 'create', value: 2 },
		{ path: '.dynamic.jtr', oldValue: undefined, type: 'create', value: 'primitive three' }
	];

	instance.setPermissions('dynamic.abc', 1);
	instance.setPermissions('dynamic.xyz', 2);

	digestedChanges = digest(changes, instance);
	expect(digestedChanges.filteredChanges).toEqual(shouldBeFiltered);
	expect(digestedChanges.spreadedChanges).toEqual(shouldBe);
	expect(digestedChanges.requiresDifferentPermissions).toBe(true);
});