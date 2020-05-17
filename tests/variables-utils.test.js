"use strict"

const { str2VarName, shuffle, realtypeof, isNumeric } = require('../utils/variables.js');

test('convert string of chars to valid variable name', () => {
	expect(str2VarName('a1bc2')).toBe('a1bc2');
	expect(str2VarName('1abcde')).toBe('_1abcde');
	expect(str2VarName('_abc')).toBe('_abc');
	expect(str2VarName('$abc')).toBe('$abc');
	expect(str2VarName('wf;90f-$L"FW:F#O-w_fa53"%{')).toBe('wf90f$LFWFOw_fa53');
});

test('shuffle an array', () => {
	let arr = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];
	expect(shuffle(arr)).not.toEqual(arr);
	expect(shuffle(arr)).not.toEqual(shuffle(arr));
});

test('check real type of variables', () => {
	expect(realtypeof(12.34)).toEqual('Number');
	expect(realtypeof('abc')).toEqual('String');
	expect(realtypeof({a: 'a'})).toEqual('Object');
	expect(realtypeof([0,1])).toEqual('Array');
	expect(realtypeof(null)).toEqual('Null');
	expect(realtypeof(new Date())).toEqual('Date');
	expect(realtypeof(function() {})).toEqual('Function');
	let aUndefined;
	expect(realtypeof(aUndefined)).toEqual('Undefined');
	expect(realtypeof(true)).toEqual('Boolean');
	expect(realtypeof(12n)).toEqual('BigInt');
	expect(realtypeof(Symbol('a'))).toEqual('Symbol');
});

test('check if value is numeric', () => {
	expect(isNumeric(1)).toBe(true);
	expect(isNumeric('1')).toBe(true);
	expect(isNumeric(1.2)).toBe(true);
	expect(isNumeric('1.2')).toBe(true);
	expect(isNumeric(0)).toBe(true);
	expect(isNumeric('0')).toBe(true);
	expect(isNumeric('')).toBe(false);
	expect(isNumeric('a')).toBe(false);
	expect(isNumeric('1a')).toBe(false);
	expect(isNumeric('1n')).toBe(false);
	expect(isNumeric('.')).toBe(false);
	expect(isNumeric('.2')).toBe(true);
});