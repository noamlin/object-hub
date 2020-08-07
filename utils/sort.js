/**
 * utility for sorting
 */
"use strict";

function swap(arr, i, j) {
	let tmp = arr[j];
	arr[j] = arr[i];
	arr[i] = tmp;
}

module.exports = exports = {
	/**
	 * kind of advanced bubble sort that goes back and forth when it finds a mismatch. when it finds a number
	 * not in order (i.e. bigger than its predecessor) it travels back (by 'j') until it finds the number's correct place
	 * and then the main loop of 'i' continues.
	 * @param {Array} arr - array to sort. reference will be mutated
	 * @param {String} [prop] - a property to sort by for arrays with objects inside
	 */
	arraySort: function(arr, prop) {
		if(arr.length >= 2) {
			let cbp = prop !== undefined; //compare by property
			for(let i=1, j, item1, item2; i < arr.length; i++) {
				j = i;
				do {
					if(cbp) {
						item1 = arr[j][prop];
						item2 = arr[j-1][prop];
					} else {
						item1 = arr[j];
						item2 = arr[j-1];
					}
					if(item1 < item2) {
						swap(arr, j, j-1);
						j--;
					} else {
						j=0;
					}
				} while(j > 0);
			}
		}
		return arr;
	}
};