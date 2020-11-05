"use strict";

const Proxserve = require('proxserve');
const { isEqual } = require('lodash');
const { realtypeof, isNumeric } = require('../../utils/variables.js');
const { defaultBasePermission, permissionsKey, path2nodeKey } = require('../../utils/globals.js');

class PermissionTree {
	constructor() {
		this[path2nodeKey] = new Map();
		//initiate empty object on base object (top parent) in order to always have something to inherit from
		this[permissionsKey] = {
			read: new Set(),
			write: new Set(),
			compiled_read: { must: new Set(), or: [] },
			compiled_write: { must: new Set(), or: [] }
		};
	}

	/**
	 * get a node by path if exist.
	 * if doesn't exist then traverse through the path and create the node and all appropriate parents
	 * @param {String} path - path to the node
	 */
	getCreateNode(path) {
		if(path[0] === '.') {
			path = path.slice(1);
		}
		
		if(path === '') {
			return this;
		}

		let node = this[path2nodeKey].get(path);
		if(typeof node !== 'undefined') {
			return node;
		}
		else {
			//handle regular path
			node = this;
			let pathArr = Proxserve.splitPath(path); //root.sub[1].alt[2] --> [root,sub,1,alt,2]
			let rePath = '';

			//traverse to current path's object and also initiate objects if needed
			for(let part of pathArr) {
				if(isNumeric(part)) {
					rePath = `${rePath}[${part}]`;
				} else {
					rePath = `${rePath}.${part}`;
				}

				if(typeof node[part] !== 'object') {
					node[part] = {};
					node[part][permissionsKey] = Object.create(node[permissionsKey]);
					this[path2nodeKey].set(rePath, node[part]);
				}
				node = node[part];
			}
		}

		return node;
	}

	/**
	 * set a permission per path. converts either single or multiple values to a hashmap.
	 * if a multiple cells path is given (for example: root[0-5].some) it recursively
	 * calls itself with specific paths (root[0].some, root[1].some...).
	 * a node's permission can overwrite its parent permission, thus defaultPermission makes a difference here and we save it.
	 * @param {String} path 
	 * @param {Array|Number|String|Null} [read] - reading permissions. 'null' for deletion
	 * @param {Array|Number|String|Null} [write] - writing permissions. 'null' for deletion
	 */
	set(path, read, write) {
		//handle range segment (e.g. 'root[0-5].some')
		var rangePart = path.match(/\[(\d+)-(\d+)\]/);
		if(rangePart !== null) { //e.g. rangePart = ['[0-5]', '0', '5', index: 4, groups: undefined, input: 'root[0-5].some']
			let pathPart1 = path.slice(0, rangePart.index); //e.g. 'root'
			let pathPart2 = path.slice(rangePart.index + rangePart[0].length); //e.g. '.some'
			let min = parseInt(rangePart[1]); //e.g. '0'
			let max = parseInt(rangePart[2]); //e.g. '5'
			if(min > max) {
				let tmp = min;
				min = max;
				max = tmp;
			}
			for(let i=min; i<=max; i++) {
				this.set(`${pathPart1}[${i}]${pathPart2}`, read, write);
			}
			return;
		}

		let node = this.getCreateNode(path);

		//handle actual reads/writes
		let RW = { 'read': read, 'write': write };
		for(let type of ['read', 'write']) {
			let typeofRW = realtypeof(RW[type]);

			if(typeofRW === 'Undefined') { //do nothing for undefined read or write
				continue;
			}
			else if(typeofRW === 'Null') { //null read or write forces delete
				if(node === this) { //we are trying to delete root permission which everybody inherits from
					node[permissionsKey][type].clear();
				} else {
					delete node[permissionsKey][type];
				}
			}
			else { //normal read/write
				if(typeofRW !== 'Array') { //convert new permissions to array
					RW[type] = [RW[type]];
				}
	
				node[permissionsKey][type] = new Set();

				for(let permission of RW[type]) {
					node[permissionsKey][type].add(permission);
				}
			}

			this.compile(Proxserve.splitPath(path), type);
		}
	}

	/**
	 * compiles reading permissions for an object with all of its parents.
	 * since children don't overwrite their parents then defaultPermission is not needed here and will be digested out.
	 * compiling writing permissions is not a needed feature since writing behaves different than reading. a client can read a sub-object only
	 * if he is permitted to read its parents, but a client can write to a sub-object even if he is not permitted to write to its parents
	 * @param {Array} pathArr - array of path segments
	 * @param {String} type - 'read' or 'write'
	 */
	compile(pathArr, type) {
		if(pathArr[0] !== '') {
			pathArr.unshift(''); //force iterating over root object too
		}
		let node = this;
		let pathPermissions = node[permissionsKey][type];
		let compiled = { must: new Set(), or: [] };

		for(let part of pathArr) {
			if(part !== '') {
				node = node[part]; //current part of path (current parent)

				if(node[permissionsKey][type] === pathPermissions) { //same permissions of parent, meaning this level doesn't have its own permissions
					continue;
				}
				pathPermissions = node[permissionsKey][type];
			}

			let PPiter = pathPermissions.values(); //pathPermissions iterator
			if(!pathPermissions.has(defaultBasePermission)) { //default is required meaning this level, as part of the compilation, is redundant
				if(pathPermissions.size === 1) {
					let permission = PPiter.next().value;
					if(!compiled.must.has(permission)) {
						//only one required permission means it's a must for this level
						compiled.must.add(permission);

						for(let i = compiled.or.length-1; i >= 0; i--) {
							if(compiled.or[i].has(permission)) { //new must permission was previously in this optional permission
								compiled.or.splice(i, 1); //remove from optional permissions
							}
						}
					}
				}
				else if(pathPermissions.size > 1) {
					//more than one means it's either of these R/W permissions in order to be permitted to this level
					let alreadyMust = false;
					for(let permission of pathPermissions) {
						if(compiled.must.has(permission)) { //one of the permissions of this level was previously a must so this entire level's requirement is redundant
							alreadyMust = true;
							break;
						}
					}

					if(!alreadyMust) {
						compiled.or.push(pathPermissions);
					}
				}
			}
		}

		let hasOwnPermissions = false;
		if(node[permissionsKey].hasOwnProperty(type) && node[permissionsKey][type].size >= 1) {
			hasOwnPermissions = true;
		}
		
		if(hasOwnPermissions) {
			node[permissionsKey][`compiled_${type}`] = compiled;
		} else {
			//reached here via recursion, but this object doesn't have it's own permissions
			//so it doesn't need compiled permissions. instead it will inherit from parent.
			if(pathArr.length === 1 && pathArr[0] === '') { //we are trying to delete root permission which everybody inherits from
				node[permissionsKey][`compiled_${type}`].must.clear();
				node[permissionsKey][`compiled_${type}`].or.length = 0;
			} else {
				delete node[permissionsKey][`compiled_${type}`];
			}
		}

		//update all children that might be affected. brute force.. inefficient.. but it doesn't matter
		//because it runs once whenever setting/updating new permissions, and not during actual runtime
		let keys = Object.keys(node);
		for(let key of keys) {
			this.compile(pathArr.concat(key), type);
		}
	}

	/**
	 * get the permissions of a path
	 * @param {String} path
	 * @param {Boolean} [getNode] - returns the node of the tree or a permission object
	 */
	get(path, getNode=false) {
		let node = this.getCreateNode(path);

		if(getNode) {
			return node;
		}
		return node[permissionsKey];
	}

	/**
	 * compares two permissions and returns true if they are (compiled) the same or false if are different
	 * @param {Object} permission1
	 * @param {Object} permission2
	 * @param {String} type - 'read' or 'write'
	 */
	compare(permission1, permission2, type) {
		if(permission1[`compiled_${type}`] !== permission2[`compiled_${type}`]) { //if not inheriting the same object
			if(!isEqual(permission1[`compiled_${type}`], permission2[`compiled_${type}`])) { //if not somehow two different compilations of the same permissions
				return false;
			}
		}

		return true;
	}
}

class ClientPermissions {
	constructor(defaultPermissions) {
		let typeofDP = realtypeof(defaultPermissions);

		switch(typeofDP) {
			case 'Undefined':
			case 'Null':
				this.defaultPermissions = []; break;
			case 'Array':
				this.defaultPermissions = defaultPermissions; break;
			default:
				this.defaultPermissions = [defaultPermissions];
		}

		this.read = new Set();
		this.write = new Set();
		//Notice - must call 'this.set()' at least once in order to apply the default permissions
	}

	/**
	 * creates client's permissions map
	 * @param {Array|Number|String} [read] - reading permissions. 'Null' for deletion
	 * @param {Array|Number|String} [write] - writing permissions. 'Null' for deletion
	 * @returns {Object} - diff between old and new permissions
	 */
	set(read, write) {
		let RW = { read: read, write: write };

		let diff = {
			read: {
				added: [],
				removed: []
			},
			write: {
				added: [],
				removed: []
			}
		};

		for(let type of ['write', 'read']) {
			let typeofRW = realtypeof(RW[type]);

			if(typeofRW === 'Undefined') {
				continue;
			}
			else if(typeofRW === 'Null') {
				RW[type] = [];
			}

			RW[type] = this.defaultPermissions.concat(RW[type]); //include default permissions
			
			let newPermissions = new Set();
			
			for(let permission of RW[type]) {
				if(!newPermissions.has(permission)) { //avoid duplicates
					newPermissions.add(permission);

					if(!this[type].has(permission)) { //this new permission didn't exist before
						diff[type].added.push(permission);
					}
				}
			}

			for(let permission of this[type]) {
				if(!newPermissions.has(permission)) { //old permission doesn't exist now
					diff[type].removed.push(permission);
				}
			}

			this[type] = newPermissions; //apply new permissions
		}

		return diff;
	}

	/**
	 * check if client is permitted to read/write a path (via its permission-node)
	 * @param {Object} permissionsNode
	 * @param {String} type - 'read' or 'write'
	 * @param {Boolean} [compiled] - verify against current node premission or compiled-with-parents permissions
	 */
	verify(permissionsNode, type, compiled=true) {
		if(compiled) {
			let must = permissionsNode[permissionsKey][`compiled_${type}`].must;
			let or = permissionsNode[permissionsKey][`compiled_${type}`].or;

			let clientSatisfiesMust = true;
			for(let mustPermission of must) {
				if(!this[type].has(mustPermission)) {
					clientSatisfiesMust = false;
					break;
				}
			}

			let clientSatisfiesOr;
			if(clientSatisfiesMust) { //this test only matters if client satisfied the 'must' permissions
				clientSatisfiesOr = true;
				for(let orLevelPermissions of or) {
					let clientSatisfiesCurrentLevel = false;
					for(let permission of orLevelPermissions) {
						if(this[type].has(permission)) {
							clientSatisfiesCurrentLevel = true;
							break;
						}
					}

					if(!clientSatisfiesCurrentLevel) {
						clientSatisfiesOr = false;
						break;
					}
				}
			}
			
			return clientSatisfiesMust && clientSatisfiesOr;
		}
		else {
			let perms = permissionsNode[permissionsKey][type];
			if(perms.size >= 1) { //there is a permission required
				for(let permission of perms) {
					if(this[type].has(permission)) { //client has the permission for this category
						return true;
					}
				}
				return false; //we matched no permission
			}

			return true; //this category doesn't require permissions
		}
	}

	/**
	 * recursively walk over all nodes verify client's permission.
	 * inefficient process that should not be run often
	 * @param {Object} permissionsNode
	 * @param {String} type - 'read' or 'write'
	 * @param {Boolean} [compiled] - verify against current node premission or compiled-with-parents permissions
	 */
	recursiveVerify(permissionsNode, type, compiled=false) {
		if(!this.verify(permissionsNode, type, compiled)) {
			return false;
		} else {
			let keys = Object.keys(permissionsNode);
			for(let key of keys) {
				if(!this.recursiveVerify(permissionsNode[key], type, compiled)) {
					return false;
				}
			}
		}
		return true;
	}
}

module.exports = exports = {
	PermissionTree: PermissionTree,
	ClientPermissions: ClientPermissions
};