"use strict"

function normalizeId(id) {
	let acceptableChars = {
		signs: {$:1, _:1},
		digits: {'1':1,'2':1,'3':1,'4':1,'5':1,'6':1,'7':1,'8':1,'9':1},
		lowercase: {a:1,b:1,c:1,d:1,e:1,f:1,g:1,h:1,i:1,j:1,k:1,l:1,m:1,n:1,o:1,p:1,q:1,r:1,s:1,t:1,u:1,v:1,w:1,x:1,y:1,z:1},
		uppercase: {A:1,B:1,C:1,D:1,E:1,F:1,G:1,H:1,I:1,J:1,K:1,L:1,M:1,N:1,O:1,P:1,Q:1,R:1,S:1,T:1,U:1,V:1,W:1,X:1,Y:1,Z:1}
	};

	let normalized = '';

	for(let i=0; i<id.length; i++) {
		if(id[i] in acceptableChars.signs || id[i] in acceptableChars.digits || id[i] in acceptableChars.lowercase || id[i] in acceptableChars.uppercase) {
			normalized += id[i];
		}
	}

	if(normalized.length === 0 || normalized[0] in acceptableChars.digits) {
		normalized = '_' + normalized;
	}

	return normalized;
}

/**
 * shuffles an array using the modern version of the Fisher–Yates shuffle
 * @param {Array} arr - the array to shuffle
 */
function shuffle(arr) {
	let j, tmp, i;
	for(i = arr.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
}

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
	normalizeId: normalizeId,

	generateEncryptionKey: generateEncryptionKey,
	makeEncryptCharFunction: makeEncryptCharFunction,
	makeDecryptCharFunction: makeDecryptCharFunction,
	encryptProperty: encryptProperty,
	decryptProperty: decryptProperty
};