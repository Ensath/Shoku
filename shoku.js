//Code based on an assignment created by Simon Niklaus
'use strict';

var express = require('express'); // do not change this line
var socket = require('socket.io'); // do not change this line
var assert = require('assert'); // do not change this line

var server = express();

server.use('/', express.static(__dirname + '/'));

var io = socket(server.listen(process.env.PORT || 8080)); // do not change this line

var objectClients = {};

var STM = 3;
var armies = ['Sun', 'Moon'];
var user = 0;
var selected = null;
var targeted = null;
var marched = [];
var fortified = null;
var boardPieces = [
['.','.','.','.','.','.'],
['.','.','.','.','.'],
['.','.','.','.','.','.'],
['.','.','.','.','.','.','.'],
['.','.','.','.','.','.'],
['.','.','.','.','.'],
['.','.','.','.','.','.']
]
var boardTiles = [
['w','f','e','w','e','e'],
['f','w','f','a','a'],
['w','a','w','f','e','f'],
['s','a','e','a','e','a','m'],
['f','e','f','w','a','w'],
['a','a','f','w','f'],
['e','e','w','e','f','w']
]

io.on('connection', function(socketHandle) {
	// assign a random id to the socket and store the socketHandle in the objectClients variable - example: '9T1P4pUQ'
	socketHandle.id = Math.random().toString(36).substr(2, 8);
	objectClients[socketHandle.id] = {
		'id': socketHandle.id,
		'socket': socketHandle,
		'army': armies[user]
	};
	if (user === 0) {
		user = 1;
	} else {
		user = 0;
	}
	// send the new client the 'hello' event, containing the assigned id - example: { 'id':'9T1P4pUQ' }
	socketHandle.emit('hello', {
		'id': socketHandle.id
	});
	// send everyone the 'clients' event, containing an array of the connected clients - example: { 'array':['GxwYr9Uz','9T1P4pUQ'] }
	var array = [];
	for (var client in objectClients) {
		array.push(objectClients[client].id);
	}
	for (var client in objectClients) {
		objectClients[client].socket.emit('clients', {
			'array': array
		});
	}
	// send everyone the 'message' event, containing a message that a new client connected - example: { 'from':'server', 'to':'everyone', 'message':'9T1P4pUQ connected' }
	for (var client in objectClients) {
		var source = '';
		if (socketHandle.id === objectClients[client].id) {
			source = 'You command';
		} else {
			source = 'Your opponent commands';
		}
		objectClients[client].socket.emit('message', {
			'from':'Server',
			'to':'everyone',
			'message': source + ' the Army of the ' + objectClients[socketHandle.id].army
		});
	}

	socketHandle.on('message', function(objectData) {
		// if the message should be recevied by everyone, broadcast it accordingly
		if(objectData.to==='everyone'){
			for (var client in objectClients) {
				var source = '';
				if (socketHandle.id === objectClients[client].id) {
					source = 'You';
				} else {
					source = 'Opponent';
				}
				objectClients[client].socket.emit('message', {
					'from':source,
					'to':'everyone',
					'message': objectData.message
				});
			}
		} else {
		// if the message has a single target, send it to this target as well as to the origin
			socketHandle.emit('message', {
				'from':socketHandle.id,
				'to': objectData.to,
				'message': objectData.message
			});
			objectClients[objectData.to].socket.emit('message', {
				'from':socketHandle.id,
				'to': objectData.to,
				'message': objectData.message
			});
		}
	});

	socketHandle.on('pushSTM', function() {
		if (objectClients[socketHandle.id].army == 'Sun') {
			if (STM < 5) { 
				STM++;
			} else {
				return;
			}
		} else {
			if (STM > 1) { 
				STM--;
			} else {
				return;
			}
		}
		update();
	});

	socketHandle.on('selectIcon', function(data) {
		//console.log("selectIcon running");
		if (selected === data.icon) {
			selected = null;
		} else {
			selected = data.icon;
		}
		update();
	});

	socketHandle.on('tapBoard', function(data) {
		if (selected === 'sa') {
			boardPieces[data.x][data.y] = 'A';
		}
		update();
	});

	socketHandle.on('disconnect', function() {
		// remove the disconnected client from the objectClients variable
		delete objectClients[socketHandle.id];
		// send everyone the 'clients' event, contianing an array of the connected clients - example: { 'array':['GxwYr9Uz'] }
		var array = [];
		for (var client in objectClients) {
			array.push(objectClients[client].id);
		}
		for (var client in objectClients) {
			objectClients[client].socket.emit('clients', {
				'array': array
			});
		}
		// send everyone the 'message' event, containing a message that an existing client disconnected - example: { 'from':'server', 'to':'everyone', 'message':'9T1P4pUQ disconnected' }
		for (var client in objectClients) {
			objectClients[client].socket.emit('message', {
				'from':'Server',
				'to':'everyone',
				'message':'Opponent disconnected'
			});
		}
	});
});

function update() {
	for (var client in objectClients) {
		objectClients[client].socket.emit('update', {
			'STM':STM,
			'selected':selected,
			'targeted':targeted,
			'fortified':fortified,
			'boardPieces':boardPieces
		});
	}
}

console.log('go ahead and open "http://localhost:8080/shoku.html" in your browser');
