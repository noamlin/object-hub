"use strict"

const { splitPath, evalPath, spread } = require('../utils/change-events.js');

test('splitPath method', () => {
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
	expect(evalPath(obj, 'aa.bb.cc')).toEqual({ object: { cc:123 }, property: 'cc' });
	expect(evalPath(obj, 'aa.bb')).toEqual({ object: { bb: { cc:123 } }, property: 'bb' });

	obj.dd = {
		ee: [
			0, [0, [0,1,2], 2], 2
		]
	};
	expect(evalPath(obj, 'dd.ee[1][1][2]')).toEqual({ object: [0,1,2], property: '2' });
	expect(evalPath(obj, 'dd.ee[1][1]')).toEqual({ object: [0, [0,1,2], 2], property: '1' });
});

test('spread changes method', () => {
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

	let spreadedChanges = spread(changes);
	expect(spreadedChanges).toEqual(shouldBe);

	changes = [
		{ path: '.dynamic.abc', oldValue: undefined, type: 'create', value: 'primitive one' },
		{ path: '.dynamic.xyz', oldValue: undefined, type: 'create', value: { a:'a', b: [0, { one: 1 }, 2], c:'c' } },
		{ path: '.dynamic.dsf', oldValue: undefined, type: 'create', value: 'primitive two' },
		{ path: '.dynamic.mno', oldValue: undefined, type: 'create', value: [0, { a:'a', arr: [13,6], c:'c' }, 2] },
		{ path: '.dynamic.jtr', oldValue: undefined, type: 'create', value: 'primitive three' }
	];

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

	spreadedChanges = spread(changes);
	expect(spreadedChanges).toEqual(shouldBe);
});