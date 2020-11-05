// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"ZDNj":[function(require,module,exports) {
/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict";
/**
 * return a string representing the full type of the variable
 * @param {*} variable 
 * @returns {String} - Object, Array, Number, String, Boolean, Null, Undefined, BigInt, Symbol, Date ...
 */

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.realtypeof = realtypeof;
exports.simpleClone = simpleClone;
exports.splitPath = splitPath;
exports.evalPath = evalPath;

function realtypeof(variable) {
  var rawType = Object.prototype.toString.call(variable); //[object Object], [object Array], [object Number] ...

  return rawType.substring(8, rawType.length - 1);
}
/**
 * recursively clones objects and array
 * @param {Proxy|Object|Array} proxy 
 */


var simpleCloneSet = new WeakSet();

function simpleClone(obj) {
  var typeofobj = realtypeof(obj);
  var cloned;

  if (typeofobj === 'Object') {
    simpleCloneSet.add(obj);
    cloned = {};
    var keys = Object.keys(obj);

    for (var _i = 0, _keys = keys; _i < _keys.length; _i++) {
      var key = _keys[_i];

      if (simpleCloneSet.has(obj[key])) {
        cloned[key] = obj[key];
      } else {
        cloned[key] = simpleClone(obj[key]);
      }
    }
  } else if (typeofobj === 'Array') {
    simpleCloneSet.add(obj);
    cloned = [];

    for (var i = 0; i < obj.length; i++) {
      if (simpleCloneSet.has(obj[i])) {
        cloned[i] = obj[i];
      } else {
        cloned[i] = simpleClone(obj[i]);
      }
    }
  } else {
    //hopefully a primitive
    cloned = obj;

    if (typeofobj !== 'Undefined' && typeofobj !== 'Null' && typeofobj !== 'Boolean' && typeofobj !== 'Number' && typeofobj !== 'BigInt' && typeofobj !== 'String') {
      console.warn("Can't clone a variable of type ".concat(typeofobj));
    }
  }

  return cloned;
}
/**
 * splits a path to an array of properties
 * (benchmarked and is faster than regex and split())
 * @param {String} path 
 */


function splitPath(path) {
  if (typeof path !== 'string' || path === '') {
    return [];
  }

  var i = 0;

  if (path[0] === '.' || path[0] === '[') {
    i = 1; //loop will skip over openning '.' or '['
  }

  var resultsArr = [];
  var tmp = '';

  for (; i < path.length; i++) {
    var char = path[i];

    if (char === '.' || char === '[') {
      resultsArr.push(tmp);
      tmp = '';
    } else if (char !== ']') {
      tmp += char;
    }
  }

  if (tmp !== '') {
    resultsArr.push(tmp);
  }

  return resultsArr;
}
/**
 * evaluate a long path and return the designated object and its referred property
 * @param {Object} obj
 * @param {String} path
 * @returns {Object} - returns {object, property, value}
 */


function evalPath(obj, path) {
  if (path === '') {
    return {
      object: obj,
      property: undefined,
      value: obj
    };
  }

  var segments = splitPath(path);
  var i;

  for (i = 0; i <= segments.length - 2; i++) {
    //iterate until one before last property because they all must exist
    obj = obj[segments[i]];

    if (typeof obj === 'undefined') {
      throw new Error("Invalid path was given - \"".concat(path, "\""));
    }
  }

  return {
    object: obj,
    property: segments[i],
    value: obj[segments[i]]
  };
}
},{}],"guaG":[function(require,module,exports) {
/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.areValidChanges = areValidChanges;
exports.simpleDeepEqual = simpleDeepEqual;
exports.xorChanges = xorChanges;

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var validChangeTypes = ['create', 'update', 'delete'];
/**
 * check if received changes is a valid array of changes
 * @param {Array.<Change>} changes 
 */

function areValidChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return false;
  }

  var _iterator = _createForOfIteratorHelper(changes),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var change = _step.value;

      if (typeof change.path !== 'string' || !validChangeTypes.includes(change.type) || !change.hasOwnProperty('value') && change.type !== 'delete'
      /*create and update must have a 'value' property*/
      || !change.hasOwnProperty('oldValue') && change.type === 'update') {
        /*update must have an 'oldValue' property*/
        return false;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return true;
}

function isObject(obj) {
  return obj !== null && _typeof(obj) === 'object';
}

function simpleDeepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (!isObject(obj1) || !isObject(obj2)) return false;
  var keys1 = Object.keys(obj1);
  var keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (var _i = 0, _keys = keys1; _i < _keys.length; _i++) {
    var key = _keys[_i];
    var val1 = obj1[key];
    var val2 = obj2[key];

    if (!simpleDeepEqual(val1, val2)) {
      return false;
    }
  }

  return true;
}
/**
 * match changes list against a secondary changes list and returns only the unique changes of the primary list
 * @param {Array.<Change>} changes
 * @param {Array.<Change>} matchAgainst
 */


function xorChanges(changes, matchAgainst) {
  var uniqueChanges = changes.slice();

  changesLoop: for (var i = 0; i < matchAgainst.length; i++) {
    var againstChange = matchAgainst[i];

    for (var j = uniqueChanges.length - 1; j >= 0; j--) {
      var change = uniqueChanges[j];

      if (change.type === againstChange.type && change.path === againstChange.path
      /*probably the same change*/
      && (change.type === 'delete' || simpleDeepEqual(change.value, againstChange.value))) {
        //both are delete or both change to the same value
        uniqueChanges.splice(j, 1);
        continue changesLoop;
      }
    }
  }

  return uniqueChanges;
}
},{}],"Kww2":[function(require,module,exports) {
/**
 * Copyright 2020 Noam Lin <noamlin@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
"use strict";

var _generalFunctions = require("../../node_modules/proxserve/general-functions.js");

var _functions = require("./functions.js");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * the change object as emitted from Proxserve
 * @typedef {Object} Change - each change emitted from Proxserve
 * @property {String} path - the path from the object listening to the property that changed
 * @property {*} value - the new value that was set
 * @property {*} oldValue - the previous value
 * @property {String} type - the type of change. may be - "create"|"update"|"delete"
 */
//switch for debugging specific behaviors that are not harming or are fixed via one side (client or server)
//those scripts are too important to delete but the debugging affects performance so it should stay shut down
var OH_DEBUG = false;

var OH = /*#__PURE__*/function () {
  function OH(domain, afterInitCallback) {
    var _this = this;

    var clientData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var proxserveOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, OH);

    this.domain = domain;
    this.id;
    this.initiated = false;
    this.changesQueue = {
      client: [],

      /*the changes made by the client*/
      server: []
      /*the changes received from the server*/

    };
    this.proxserveOptions = {
      delay: proxserveOptions.delay !== undefined ? proxserveOptions.delay : 10,
      strict: proxserveOptions.strict !== undefined ? proxserveOptions.strict : true,
      emitReference: proxserveOptions.emitReference !== undefined ? proxserveOptions.emitReference : false
    };
    this.socket = io("/oh-".concat(domain), {
      autoConnect: true,
      reconnection: true,
      query: {
        data: JSON.stringify(clientData)
      }
    });
    this.socket.on('init', function (data) {
      //gets initiated with data from the server
      _this.id = data.id;

      if (data.obj) {
        _this.object = new Proxserve(data.obj, _this.proxserveOptions);

        _this.object.on('change', _this.onObjectChange.bind(_this)); //when client alters the object


        _this.initiated = true;

        if (afterInitCallback) {
          afterInitCallback(_this.object);
        }
      }
    });
    this.socket.on('change', function (changes) {
      if (_this.initiated) {
        _this.updateObject(changes);
      }
    });
  }
  /**
   * changes received from the server
   * @param {Array.<Change>} changes 
   */


  _createClass(OH, [{
    key: "updateObject",
    value: function updateObject(changes) {
      if ((0, _functions.areValidChanges)(changes)) {
        //prevent infinite loop of:
        //client changes & notify server -> server changes & notify client -> client changes again & notify again..
        var uniqueChanges = (0, _functions.xorChanges)(changes, this.changesQueue.client);
        this.changesQueue.client = []; //check against client-made-changes should happen for only one cycle

        var _iterator = _createForOfIteratorHelper(uniqueChanges),
            _step;

        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var change = _step.value;
            this.changesQueue.server.push(change); //save the change - value references might be altered later

            var parts = Proxserve.splitPath(change.path);
            var currObj = this.object;

            while (typeof currObj[parts[0]] !== 'undefined' && parts.length > 1) {
              currObj = currObj[parts.shift()];
            }

            if (parts.length === 1) {
              //previous loop finished on time
              switch (change.type) {
                case 'create':
                case 'update':
                  if (OH_DEBUG && change.type === 'create' && typeof currObj[parts[0]] !== 'undefined') {
                    console.warn('tried to create a new property but instead updated an existing one:');
                    console.warn(change);
                  }

                  if (!(0, _functions.simpleDeepEqual)(currObj[parts[0]], change.value)) {
                    //update only if values are completely different. this helps avoid double asigning of new objects.
                    //for example - the client sets a new object {a:1}, then updates the server which in turn updates the
                    //client which will see that the local {a:1} is not the same reference as the server's {a:1}
                    if (_typeof(change.value) !== 'object') {
                      currObj[parts[0]] = change.value;
                    } else {
                      //don't point to original 'change.value' so later it will not get altered and then fail on 'xorChanges'
                      currObj[parts[0]] = (0, _generalFunctions.simpleClone)(change.value);
                    }
                  }

                  break;

                case 'delete':
                  delete currObj[parts[0]];
                  break;
              }
            } else {
              console.error('couldn\'t loop completely over path', change);
            }

            if (typeof change.reason === 'string' && change.reason.length >= 1) {
              console.warn(change.path, change.reason);
            }
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }

        ;
      } else {
        console.error('changes received from server are not valid', changes);
      }
    }
    /**
     * changes made by the client
     * @param {Array.<Change>} changes 
     */

  }, {
    key: "onObjectChange",
    value: function onObjectChange(changes) {
      //work on a copy of 'changes' in order not to change the reference of changes which is also used by client's listeners.
      //prevent infinite loop of:
      //server changes & notify client -> client changes & notify server -> server changes again & notify again..
      var uniqueChanges = (0, _functions.xorChanges)(changes, this.changesQueue.server);
      this.changesQueue.server = []; //check against server-changes should happen for only one cycle

      if (uniqueChanges.length >= 1) {
        this.changesQueue.client = this.changesQueue.client.concat(uniqueChanges);
        this.socket.emit('change', uniqueChanges);
      }
    }
  }]);

  return OH;
}();

;
module.exports = exports = OH; //makes ParcelJS expose this globally (for all platforms) after bundling everything
},{"../../node_modules/proxserve/general-functions.js":"ZDNj","./functions.js":"guaG"}]},{},["Kww2"], "OH")
//# sourceMappingURL=/oh.js.map