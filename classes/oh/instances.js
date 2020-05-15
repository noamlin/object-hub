"use strict"

var proxy2instance = new WeakMap();
var instance2proxy = new WeakMap();

module.exports = exports = {
	/**
	 * set a new entry of proxy->instance in the proxies map
	 * @param {Proxy} proxy 
	 * @param {Object} instance 
	 */
	set: function(proxy, instance) {
		proxy2instance.set(proxy, instance);
		instance2proxy.set(instance, proxy);
	},
	/**
	 * get instance by proxy
	 * @param {Proxy} proxy 
	 */
	getInstance: function(proxy) {
		return proxy2instance.get(proxy);
	},
	/**
	 * get proxy by instance
	 * @param {Object} instance 
	 */
	getProxy: function(instance) {
		return instance2proxy.get(instance);
	}
};