"use strict"

const generalUtils = require('./utils/general.js');

let tests = [1234, 56.78901, true, false, 'f', 'D@Q_+Q@`K;Ldsa~zz', [2,4,6], {a:'b', c:'d'}];

let key = generalUtils.generateEncryptionKey();
let encCharFunc = generalUtils.makeEncryptCharFunction(key);
let decCharFunc = generalUtils.makeDecryptCharFunction(key);

for(let item of tests) {
	let enc = generalUtils.encryptProperty(item, encCharFunc);
	let dec = generalUtils.decryptProperty(enc, decCharFunc);
	console.log(`encrypted: ${enc}`);
	console.log(`decrypted: ${dec}`);
	console.log(' ');
}