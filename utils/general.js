"use strict"

function str2VarName(id) {
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

/**
 * return a string representing the full type of the variable
 * @param {*} variable 
 * @returns {String} - Object, Array, Number, String, Boolean, Null, Undefined, BigInt, Symbol, Date ...
 */
function realtypeof(variable) {
	let rawType = Object.prototype.toString.call(variable); //[object Object], [object Array], [object Number] ...
	return rawType.substring(8, rawType.length-1);
}

/**
 * check if variable is a number or a string of a number
 * @param {*} variable 
 */
function isNumeric(variable) {
	if(typeof variable === 'string' && variable === '') return false;
	else return !isNaN(variable);
}

module.exports = exports = {
	str2VarName: str2VarName,
	shuffle: shuffle,
	realtypeof: realtypeof,
	isNumeric: isNumeric
};