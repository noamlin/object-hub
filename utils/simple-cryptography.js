"use strict"

const { shuffle } = require('./variables.js');

const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{} <>:;_+-="\'.,/?';

/**
 * generates a function that encrypts from chars letters to key letters or vice versa
 * @param {String} key 
 * @param {Boolean} shouldDecrypt - if true will decrypt by key
 */
function makeEncryptDecryptCharFunction(key, shouldDecrypt) {
	let from = chars;
	let to = key;

	if(shouldDecrypt) {
		from = key;
		to = chars;
	}

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

module.exports = exports = class simpleCrypto {
	constructor() {
		this._key = shuffle(chars.split('')).join('');
		this._encryptCharFunction = makeEncryptDecryptCharFunction(this._key, false);
		this._decryptCharFunction = makeEncryptDecryptCharFunction(this._key, true);
	}

	getKey() {
		return this._key;
	}

	encrypt(variable) {
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
			encStr += this._encryptCharFunction(str[i]);
		}
	
		return encStr;
	}

	decrypt(str) {
		if(typeof str !== 'string') {
			throw new Error('variable to decrypt must be a string');
		}
	
		let decStr = '';
		for(let i=0; i < str.length; i++) {
			decStr += this._decryptCharFunction(str[i]);
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
};