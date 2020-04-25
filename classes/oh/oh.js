"use strict"

const EventEmitter = require('events');
const socketio = require('socket.io');
const Proxserve = require('proxserve');
const handlers = require('./handlers.js');
const { realtypeof, str2VarName } = require('../../utils/general.js');

var reservedVariables = ['__rootPath', '__permissions', '__io', 'clients', 'setPermission', 'setClientPermissions', 'destroy'];

module.exports = exports = class Oh extends EventEmitter {
	constructor(rootPath, server, infrastructure = {}) {
		super();

		if(str2VarName(rootPath) !== rootPath) {
			throw new Error('root path must match a valid object\'s property name');
		} else if(reservedVariables.indexOf(rootPath) !== -1) {
			throw new Error('root path is system reserved');
		}

		this.__rootPath = rootPath;
		this.__permissions = {};
		this.clients = new Map();
		this.__io = socketio(server).of(`/object-hub/${rootPath}`);

		this.__io.on('connection', (socket) => {
			handlers.onConnection.call(this, socket);
			socket.on('disconnect', handlers.onDisconnection.bind(this, socket));
			socket.on('change', handlers.onClientObjectChange.bind(this, socket));
		});

		this[rootPath] = new Proxserve(infrastructure);
		this[rootPath].on('change', handlers.onObjectChange.bind(this));
	}

	/**
	 * set a permission per path. converts either single or multiple values to a hashmap.
	 * if a multiple cells path is given (for example: root[0-5].some) it recursively
	 * calls itself with specific paths (root[0].some, root[1].some...)
	 * @param {String} path 
	 * @param {Array|Number|String} writes - writing permissions
	 * @param {Array|Number|String} [reads] - reading permissions 
	 */
	setPermission(path, writes, reads=0) {
		var rangePart = path.match(/\[(\d+)-(\d+)\]/);
		if(rangePart !== null) {
			let pathPart1 = path.slice(0, rangePart.index);
			let pathPart2 = path.slice(rangePart.index + rangePart[0].length);
			let min = parseInt(rangePart[1]);
			let max = parseInt(rangePart[2]);
			if(min > max) {
				let tmp = min;
				min = max;
				max = tmp;
			}
			for(let i=min; i<=max; i++) {
				this.setPermission(`${pathPart1}[${i}]${pathPart2}`, writes, reads);
			}
			return;
		}

		let pathArr = Proxserve.splitPath(path); //root.sub[1].alt[2] --> [root,sub,1,alt,2]
		let pathObj = this.__permissions;

		for(let part of pathArr) { //traverse to current path's object and also initiate objects if needed
			if(typeof pathObj[part] !== 'object') {
				pathObj[part] = {};
			}
			pathObj = pathObj[part];
		}

		let newPermissions = { 'writes': writes, 'reads': reads };
		for(let type of ['writes', 'reads']) {
			if(!Array.isArray(newPermissions[type])) {
				newPermissions[type] = [newPermissions[type]]; //convert new permissions to array
			}

			for(let i = newPermissions[type].length - 1; i >= 0; i--) {
				if(newPermissions[type][i] === 0 || newPermissions[type][i] === '0') {
					newPermissions[type].splice(i, 1); //delete all zeros
				}
			}

			if(newPermissions[type].length >= 1) {
				pathObj['__'+type] = {};
				for(let permission of newPermissions[type]) {
					pathObj['__'+type][ permission ] = true;
				}
			} else { //has no own writes
				delete pathObj['__'+type];
			}
		}

		this.compilePermissions(pathArr);
	}

	compilePermissions(pathArr) {
		let pathObj = this.__permissions;
		let compiled = {
			writes: { must: [], or: [] },
			reads: { must: [], or: [] }
		};
		let types = ['writes', 'reads'];

		for(let part of pathArr) {
			pathObj = pathObj[part]; //current part of path (current parent)

			for(let type of types) {
				if(typeof pathObj['__'+type] !== 'object') {
					continue; //this level doesn't have permissions
				}
				let currentLevelPermissions = Object.keys(pathObj['__'+type]); //writing permissions to reach current path part
				if(currentLevelPermissions.length === 1 && !compiled[type].must.includes(currentLevelPermissions[0])) { //only one required permissions means it's a must for this level
					compiled[type].must.push(currentLevelPermissions[0]);

					for(let i = compiled[type].or.length-1; i >= 0; i--) {
						if(compiled[type].or[i].includes(currentLevelPermissions[0])) { //new must permission was previously an optional permission
							compiled[type].or.splice(i, 1); //remove from optional permissions
						}
					}
				}
				else if(currentLevelPermissions.length > 1) { //more than one means it's either of these writing permissions in order to be permitted to this level
					let alreadyMust = false;
					for(let aPermission of currentLevelPermissions) {
						if(compiled[type].must.includes(aPermission)) { //one of the permissions of this level was previously a must so this entire level's requirement is redundant
							alreadyMust = true;
							break;
						}
					}
					if(!alreadyMust) {
						compiled[type].or.push(currentLevelPermissions);
					}
				}
			}
		}

		let hasOwnPermissions = false;
		for(let type of types) {
			if(typeof pathObj['__'+type] === 'object') {
				if(Object.keys(pathObj['__'+type]).length >= 1) {
					hasOwnPermissions = true;
				}
			}
		}
		if(hasOwnPermissions) {
			pathObj.__compiled = compiled;
		} else {
			//reached here via recursion, but this object doesn't have it's own permissions.
			//sp it doesn't need compiled permissions. instead it will inherit from parent.
			delete pathObj.__compiled;
		}

		//update all children that might be affected
		let keys = Object.keys(pathObj);
		for(let key of keys) {
			if(key !== '__writes' && key !== '__reads' && key !== '__compiled') {
				this.compilePermissions(pathArr.concat(key));
			}
		}
	}

	/**
	 * set client's authorization level and update re-assign his rooms
	 * @param {Object} socket 
	 * @param {Number} writes
	 * @param {Number} [reads]
	 */
	setClientPermissions(socket, newWrites, newReads) {
		//handle write
		socket.OH.permissions.writes = {};
		socket.OH.permissions.writes[ socket.OH.id ] = true; //client id
		if(!Array.isArray(newWrites)) {
			newWrites = [newWrites];
		}
		for(let write of newWrites) {
			if(write !== 0 && write !== '0') {
				socket.OH.permissions.writes[ write ] = true;
			}
		}
	
		//handle read
		let oldReads = socket.OH.permissions.reads;
		socket.OH.permissions.reads = {};
		socket.OH.permissions.reads[ socket.OH.id ] = true; //client id
		let readsType = realtypeof(newReads);
		if(readsType !== 'Undefined' && readsType !== 'Null') {
			if(readsType !== 'Array') {
				newReads = [newReads];
			}
			for(let read of newReads) {
				if(read !== 0 && read !== '0') {
					socket.OH.permissions.reads[ read ] = true;
				}
			}
		}

		let oldReadsType = realtypeof(oldReads);
		if(oldReadsType === 'Undefined' || oldReadsType === 'Null') {
			oldReads = {};
		}
		let oldReadKeys = Object.keys(oldReads);
		for(let read of oldReadKeys) {
			if(!socket.OH.permissions.reads[ read ]) { //doesn't exist anymore
				socket.leave(`level_${read}`);
			}
		}

		let newReadKeys = Object.keys(socket.OH.permissions.reads);
		for(let read of newReadKeys) {
			if(!oldReads[ read ]) { //a completely new reading permission
				socket.join(`level_${read}`);
			}
		}
	}

	/**
	 * destroy the instance and the connections
	 * @param {Function} [cb] - a callback function
	 */
	destroy(cb) {
		let originalObj = this[this.__rootPath].getOriginalTarget();
		setImmediate(() => {
			//first disconnect all clients and trigger all 'disconnection' events which might still be using the proxy object
			let socketsKeys = Object.keys(this.__io.connected);
			for(let key of socketsKeys) {
				this.__io.connected[key].disconnect(true);
			}
			this.__io.removeAllListeners('connection');
			this.clients.clear();

			setImmediate(() => {
				Proxserve.destroy(this[this.__rootPath]);

				setImmediate(() => {
					delete this[this.__rootPath];
					for(let item of reservedVariables) {
						delete this[item];
					}

					if(typeof cb === 'function') {
						cb( originalObj );
					}
				});
			});
		});
	}
};