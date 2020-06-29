"use strict";

const { PermissionTree, ClientPermissions } = require('../classes/permissions/permissions.js');
const { defaultBasePermission, permissionsKey } = require('../utils/globals.js');

test('1. instantiate a PermissionTree', () => {
	let permissionTree = new PermissionTree();
	expect(permissionTree[permissionsKey]).toEqual({
		read: new Set(),
		write: new Set(),
		compiled_read: { must: new Set(), or: [] },
		compiled_write: { must: new Set(), or: [] }
	});
});

test('2. set permissions for different paths', () => {
	let permissionTree = new PermissionTree();

	permissionTree.set('a_number', defaultBasePermission, defaultBasePermission);
	expect(permissionTree.a_number[permissionsKey].read).toEqual(new Set([defaultBasePermission]));
	expect(permissionTree.a_number[permissionsKey].write).toEqual(new Set([defaultBasePermission]));

	permissionTree.set('n1.n2', 4, 5);
	expect(permissionTree.n1.n2[permissionsKey].read).toEqual(new Set([4]));
	expect(permissionTree.n1.n2[permissionsKey].write).toEqual(new Set([5]));

	permissionTree.set('n1.n2.n3', [0,3,4,5], [0,6,7,8]);
	expect(permissionTree.n1.n2.n3[permissionsKey].read).toEqual(new Set([0,3,4,5]));
	expect(permissionTree.n1.n2.n3[permissionsKey].write).toEqual(new Set([0,6,7,8]));

	permissionTree.set('n1.n2.n3', undefined, null); //read unchanged. write deleted thus inheriting from parent
	expect(permissionTree.n1.n2.n3[permissionsKey].read).toEqual(new Set([0,3,4,5]));
	expect(permissionTree.n1.n2.n3[permissionsKey].write === permissionTree.n1.n2[permissionsKey].write).toBe(true);

	permissionTree.set('n1.n2', undefined, [4,5,6]);
	expect(permissionTree.n1.n2.n3[permissionsKey].write).toEqual(new Set([4,5,6]));//n3 'write' is parent

	permissionTree.set('arr1.arr2[0-1]', 1, 1);
	expect(permissionTree.arr1.arr2['0'][permissionsKey].read).toEqual(new Set([1]));
	expect(permissionTree.arr1.arr2['0'][permissionsKey].write).toEqual(new Set([1]));
	expect(permissionTree.arr1.arr2['1'][permissionsKey].read).toEqual(new Set([1]));
	expect(permissionTree.arr1.arr2['1'][permissionsKey].write).toEqual(new Set([1]));

	permissionTree.set('arr1[4-5]', 0, 2);
	expect(permissionTree.arr1['4'][permissionsKey].read).toEqual(new Set([0]));
	expect(permissionTree.arr1['4'][permissionsKey].write).toEqual(new Set([2]));
	expect(permissionTree.arr1['5'][permissionsKey].read).toEqual(new Set([0]));
	expect(permissionTree.arr1['5'][permissionsKey].write).toEqual(new Set([2]));
});

test('3. get permission or node', () => {
	let permissionTree = new PermissionTree();

	permissionTree.set('inner1', 1, 2);
	permissionTree.set('inner1.inner2', 'a', 'b');
	permissionTree.set('inner1.inner2.inner3', undefined, [6,7]);

	let inner = permissionTree.get('inner1');
	expect(inner).toEqual({
		read: new Set([1]),
		write: new Set([2]),
		compiled_read: {
			must: new Set([1]),
			or: []
		},
		compiled_write: {
			must: new Set([2]),
			or: []
		}
	});
	expect(permissionTree.get('inner1', false) === inner).toBe(true);

	let innerNode = permissionTree.get('inner1', true);
	expect(innerNode[permissionsKey] === inner).toBe(true);
	expect(innerNode.hasOwnProperty('inner2')).toBe(true);
	expect(innerNode.inner2.hasOwnProperty('inner3')).toBe(true);

	innerNode = permissionTree.get('inner1.inner2.inner3', true);
	inner =  permissionTree.get('inner1.inner2');
	expect(inner.read === innerNode[permissionsKey].read).toBe(true); //same object since inhereting from parent
});

test('4. compare method', () => {
	let permissionTree = new PermissionTree();

	permissionTree.set('inner1', [1,2,3], ['a','b','c']);
	permissionTree.set('inner1.inner2', undefined, null); //never set before so undefined/null should act the same
	permissionTree.set('inner1.inner2.inner3', 4, undefined);
	permissionTree.set('inner1.inner2.inner3.inner4', ['x','y','z']);

	let inner1 = permissionTree.get('inner1');
	let inner2 = permissionTree.get('inner1.inner2');
	expect(permissionTree.compare(inner1, inner2, 'read')).toBe(true);
	expect(permissionTree.compare(inner1, inner2, 'write')).toBe(true);

	let inner3 = permissionTree.get('inner1.inner2.inner3');
	expect(permissionTree.compare(inner1, inner3, 'read')).toBe(false);
	expect(permissionTree.compare(inner1, inner3, 'write')).toBe(true);

	permissionTree.set('other1', [1,2,3]);
	permissionTree.set('other1.other2', 4);
	permissionTree.set('other1.other2.other3', ['x','y','z']);

	let inner4 = permissionTree.get('inner1.inner2.inner3.inner4');
	let other = permissionTree.get('other1.other2.other3');
	expect(permissionTree.compare(inner4, other, 'read')).toBe(true); //compiled to exactly the same
	expect(permissionTree.compare(inner4, other, 'write')).toBe(false); //didn't compile the same
});

test('5. compile permissions', () => {
	let permissionTree = new PermissionTree();
	permissionTree.set('', 1, 2);
	permissionTree.set('inner1', 3);
	permissionTree.set('inner1.inner2', [5,6,7], ['a','b','c']);
	permissionTree.set('inner1.inner2.inner3', ['x','y','z']);
	
	let read = permissionTree[permissionsKey].compiled_read;
	let write = permissionTree[permissionsKey].compiled_write;
	expect(read).toEqual({
		must: new Set([1]),
		or: []
	});
	expect(write).toEqual({
		must: new Set([2]),
		or: []
	});

	read = permissionTree.inner1[permissionsKey].compiled_read;
	write = permissionTree.inner1[permissionsKey].compiled_write;
	expect(read).toEqual({
		must: new Set([1,3]),
		or: []
	});
	expect(write).toEqual({
		must: new Set([2]),
		or: []
	});

	read = permissionTree.inner1.inner2[permissionsKey].compiled_read;
	write = permissionTree.inner1.inner2[permissionsKey].compiled_write;
	expect(read).toEqual({
		must: new Set([1,3]),
		or: [new Set([5,6,7])]
	});
	expect(write).toEqual({
		must: new Set([2]),
		or: [new Set(['a','b','c'])]
	});

	read = permissionTree.inner1.inner2.inner3[permissionsKey].compiled_read;
	write = permissionTree.inner1.inner2.inner3[permissionsKey].compiled_write;
	expect(read).toEqual({
		must: new Set([1,3]),
		or: [new Set([5,6,7]), new Set(['x','y','z'])]
	});
	expect(write).toEqual({
		must: new Set([2]),
		or: [new Set(['a','b','c'])]
	});

	permissionTree.set('', null, null);
	permissionTree.set('inner1', ['f','g'], ['h','j']);
	permissionTree.set('inner1.inner2', null, null);

	read = permissionTree.inner1.inner2[permissionsKey].compiled_read; //inner2, the deleted one
	write = permissionTree.inner1.inner2[permissionsKey].compiled_write; //inner2, the deleted one
	expect(permissionTree.inner1[permissionsKey].compiled_read === read).toBe(true);
	expect(permissionTree.inner1[permissionsKey].compiled_write === write).toBe(true);

	read = permissionTree.inner1.inner2.inner3[permissionsKey].compiled_read;
	write = permissionTree.inner1.inner2.inner3[permissionsKey].compiled_write;
	expect(read).toEqual({
		must: new Set(),
		or: [new Set(['f','g']), new Set(['x','y','z'])]
	});
	expect(permissionTree.inner1[permissionsKey].compiled_write === write).toBe(true);
	expect(write).toEqual({
		must: new Set(),
		or: [new Set(['h','j'])]
	});
});

test('6. instantiate ClientPermissions', () => {
	let clientPermissions = new ClientPermissions();
	expect(clientPermissions).toEqual({
		defaultPermissions: [],
		read: new Set(),
		write: new Set()
	});

	clientPermissions = new ClientPermissions('default_permission');
	expect(clientPermissions).toEqual({
		defaultPermissions: ['default_permission'],
		read: new Set(),
		write: new Set()
	});

	clientPermissions = new ClientPermissions([0]);
	expect(clientPermissions).toEqual({
		defaultPermissions: [0],
		read: new Set(),
		write: new Set()
	});
});

test('7. set ClientPermissions', () => {
	let clientPermissions = new ClientPermissions(123);
	let diff = clientPermissions.set();
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set(),
		write: new Set()
	});
	expect(diff).toEqual({
		read: {
			added: [],
			removed: []
		},
		write: {
			added: [],
			removed: []
		}
	});

	diff = clientPermissions.set(null);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123]),
		write: new Set()
	});
	expect(diff).toEqual({
		read: {
			added: [123],
			removed: []
		},
		write: {
			added: [],
			removed: []
		}
	});

	diff = clientPermissions.set(undefined, null);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123]),
		write: new Set([123])
	});
	expect(diff).toEqual({
		read: {
			added: [],
			removed: []
		},
		write: {
			added: [123],
			removed: []
		}
	});

	diff = clientPermissions.set(1, 'a');
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123, 1]),
		write: new Set([123, 'a'])
	});
	expect(diff).toEqual({
		read: {
			added: [1],
			removed: []
		},
		write: {
			added: ['a'],
			removed: []
		}
	});

	diff = clientPermissions.set([2,3,4], null);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123, 2,3,4]),
		write: new Set([123])
	});
	expect(diff).toEqual({
		read: {
			added: [2,3,4],
			removed: [1]
		},
		write: {
			added: [],
			removed: ['a']
		}
	});

	clientPermissions.set(undefined, 'a');
	diff = clientPermissions.set(null, ['a','b','c']);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123]),
		write: new Set([123, 'a','b','c'])
	});
	expect(diff).toEqual({
		read: {
			added: [],
			removed: [2,3,4]
		},
		write: {
			added: ['b','c'],
			removed: []
		}
	});

	diff = clientPermissions.set(undefined, undefined);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123]),
		write: new Set([123, 'a','b','c'])
	});
	expect(diff).toEqual({
		read: {
			added: [],
			removed: []
		},
		write: {
			added: [],
			removed: []
		}
	});

	clientPermissions.set([1,2], ['a','b']);
	diff = clientPermissions.set([2,3], ['b','c']);
	expect(clientPermissions).toEqual({
		defaultPermissions: [123],
		read: new Set([123, 2,3]),
		write: new Set([123, 'b','c'])
	});
	expect(diff).toEqual({
		read: {
			added: [3],
			removed: [1]
		},
		write: {
			added: ['c'],
			removed: ['a']
		}
	});
});

test('8. verify ClientPermissions with PermissionTree-node', () => {
	let clientPermissions = new ClientPermissions(defaultBasePermission);
	clientPermissions.set(1, 3);

	let PT = new PermissionTree();
	PT.set('', defaultBasePermission, defaultBasePermission);
	PT.set('node1', 'a', 'b');
	PT.set('node1.node2', [1,2], [3,4]);
	PT.set('node1.node2.node3', ['c','d'], 6);

	let isVerified = clientPermissions.verify(PT, 'read', false);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1', true), 'read', false);
	expect(isVerified).toBe(false);

	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'read', false); //not against compiled permissions
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'write', false); //not against compiled permissions
	expect(isVerified).toBe(true);
	
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'read', true); //against compiled permissions
	expect(isVerified).toBe(false);
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'write', true); //against compiled permissions
	expect(isVerified).toBe(false);

	clientPermissions.set(['a',2], ['b',3]);
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'read', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'write', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'read', true);
	expect(isVerified).toBe(false);
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'write', true);
	expect(isVerified).toBe(false);

	clientPermissions.set(['a',1,'d'], ['b',6,4]);
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'read', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'write', true);
	expect(isVerified).toBe(true);

	PT.set('node1.node2', null, null);
	clientPermissions.set(null, null);
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'read', true);
	expect(isVerified).toBe(false); //should still fail because actually looking at parent (node1) permissions
	isVerified = clientPermissions.verify(PT.get('node1.node2', true), 'write', true);
	expect(isVerified).toBe(false); //should still fail because actually looking at parent (node1) permissions

	isVerified = clientPermissions.verify(PT, 'read', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT, 'write', true);
	expect(isVerified).toBe(true);

	PT.set('', null, null);
	isVerified = clientPermissions.verify(PT, 'read', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT, 'write', true);
	expect(isVerified).toBe(true);

	PT.set('', 'x', ['y','z']);
	clientPermissions.set(['x','a','c'], ['y','b',6]); //node2 is deleted
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'read', true);
	expect(isVerified).toBe(true);
	isVerified = clientPermissions.verify(PT.get('node1.node2.node3', true), 'write', true);
	expect(isVerified).toBe(true);
});