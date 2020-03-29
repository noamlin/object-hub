"use strict"

const Oh = require('../classes/oh/oh.js');
const http = require('http');
const server = http.createServer();

var testOH = new Oh('root', server, {});

test('check OH instance methods', () => {
	expect(typeof testOH.setPermission).toBe('function');
});