"use strict"

const { arraySort } = require('../utils/sort.js');

test('Sort of simple arrays of numbers', () => {
	let arr = [1,2];
	arraySort(arr);
	expect(arr).toEqual([1,2]);

	arr = [3,2];
	arraySort(arr);
	expect(arr).toEqual([2,3]);

	arr = [9,3,8,4,1,7,2,6,5];
	arraySort(arr);
	expect(arr).toEqual([1,2,3,4,5,6,7,8,9]);

	arr = [0,1,2,3,4,5,6];
	arraySort(arr);
	expect(arr).toEqual([0,1,2,3,4,5,6]);

	arr = [7,6,5,4,3,2,1,0,-1,-2];
	arraySort(arr);
	expect(arr).toEqual([-2,-1,0,1,2,3,4,5,6,7]);
});

test('Sort of arrays of objects', () => {
	let arr = [{num:9},{num:3},{num:8},{num:4},{num:1},{num:7},{num:2},{num:6},{num:5}];
	arraySort(arr, 'num');
	expect(arr).toEqual([{num:1},{num:2},{num:3},{num:4},{num:5},{num:6},{num:7},{num:8},{num:9}]);

	arr = [[9],[3],[8],[4],[1],[7],[2],[6],[5]];
	arraySort(arr, 0);
	expect(arr).toEqual([[1],[2],[3],[4],[5],[6],[7],[8],[9]]);

	arr = [{a:'a', '1':5},{a:'a', '1':4},{a:'a', '1':3},{a:'a', '1':2},{a:'a', '1':1}];
	arraySort(arr, '1');
	expect(arr).toEqual([{a:'a', '1':1},{a:'a', '1':2},{a:'a', '1':3},{a:'a', '1':4},{a:'a', '1':5}]);
});