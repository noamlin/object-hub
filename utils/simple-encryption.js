"use strict"

const { shuffle } = require('./general.js');

const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{} <>+-="\'.,/?';

function generateEncryptionKey() {
	return shuffle(chars.split('')).join('');
}

function _makeEncryptDecryptCharFunction(from, to) {
	let switchCode = 'switch(char) {';
	for(let i=0; i < from.length; i++) {
		let fromChar = from[i];
		if(fromChar === "'") {
			fromChar = "\\'";
		}

		let toChar = to[i];
		if(toChar === "'") {
			toChar = "\\'";
		}

		switchCode += `case '${fromChar}': return '${toChar}'; break;`;
	}
	switchCode += 'default: return char; }';
	/*switch(char) {
		case 'a': return key[0]; break;
		default: return char;
	}*/

	/**
	 * returns a function that encrypts/decrypts a character
	 * @param {String} char - the character to encrypt
	 */
	return Function(`"use strict"; return function(char) { ${switchCode} };`)();
}

/**
 * generate a single letter encryption function by key
 * @param {String} key 
 */
function makeEncryptCharFunction(key) {
	return _makeEncryptDecryptCharFunction(chars, key);
}

/**
 * generate a single letter decryption function by key
 * @param {String} key 
 */
function makeDecryptCharFunction(key) {
	return _makeEncryptDecryptCharFunction(key, chars);
}

function encryptProperty(variable, encryptCharFunction) {
	let varType = typeof variable;
	let prefix, str, encStr = '';

	if(varType === 'number') {
		if(Number.isInteger(variable)) {
			prefix = '[int]';
		} else {
			prefix = '[flt]';
		}
		str = prefix + variable.toString();
	}
	else if(varType === 'string') {
		prefix = '[str]';
		str = prefix + variable;
	}
	else if(varType === 'boolean') {
		prefix = '[bol]';
		str = prefix + (variable ? '1' : '0');
	}
	else if(Array.isArray(varType)) {
		prefix = '[arr]';
		str = prefix + JSON.stringify(variable);
	}
	else { //object
		prefix = '[obj]';
		str = prefix + JSON.stringify(variable);
	}

	for(let i=0; i < str.length; i++) {
		encStr += encryptCharFunction(str[i]);
	}

	return encStr;
}

function decryptProperty(str, decryptCharFunction) {
	if(typeof str !== 'string') {
		throw new Error('variable to decrypt must be a string');
	}

	let decStr = '';
	for(let i=0; i < str.length; i++) {
		decStr += decryptCharFunction(str[i]);
	}

	let prefix = decStr.substring(0,5);
	let variable = decStr.substring(5);

	if(prefix === '[int]') {
		variable = parseInt(variable);
	}
	else if(prefix === '[flt]') {
		variable = parseFloat(variable);
	}
	else if(prefix === '[bol]') {
		variable = (variable === '1' ? true : false);
	}
	else if(prefix === '[arr]') {
		variable = JSON.parse(variable);
	}
	else if(prefix === '[obj]') {
		variable = JSON.parse(variable);
	}
	else if(prefix === '[str]') {
		//no need to do a thing
	} else {
		throw new Error('variable to decrypt isn\'t a valid string');
	}

	return variable;
}

module.exports = exports = {
	generateEncryptionKey: generateEncryptionKey,
	makeEncryptCharFunction: makeEncryptCharFunction,
	makeDecryptCharFunction: makeDecryptCharFunction,
	encryptProperty: encryptProperty,
	decryptProperty: decryptProperty
};