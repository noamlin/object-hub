"use strict"

const Crypto = require('../utils/simple-cryptography.js');

let testCrypto = new Crypto();

test('generate encryption key 87 chars long', () => {
	expect(typeof testCrypto.getKey()).toBe('string');
	expect(testCrypto.getKey().length).toBe(91);
});

test('encrypt & decrypt integer', () => {
	let subject = 1234;
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toBe(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toBe(subject);
});

test('encrypt & decrypt float', () => {
	let subject = 67.891011;
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toBe(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toBe(subject);
});

test('encrypt & decrypt boolean', () => {
	let enc = testCrypto.encrypt(true);
	expect(enc).not.toBe(true);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toBe(true);

	enc = testCrypto.encrypt(false);
	expect(enc).not.toBe(false);
	dec = testCrypto.decrypt(enc);
	expect(dec).toBe(false);
});

test('encrypt & decrypt regular string', () => {
	let subject = 'a1b2c3d[4]e-5=';
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toBe(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toBe(subject);
});

test('encrypt & decrypt special chars string', () => {
	let subject = '~a`1b2אcה3d[ל4]e-5=';
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toBe(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toBe(subject);
});

test('encrypt & decrypt array', () => {
	let subject = [0,1,2];
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toEqual(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toEqual(subject);
});

test('encrypt & decrypt object', () => {
	let subject = {a:'b', c:'d'};
	let enc = testCrypto.encrypt(subject);
	expect(enc).not.toEqual(subject);
	let dec = testCrypto.decrypt(enc);
	expect(dec).toEqual(subject);
});