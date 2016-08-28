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
var selectedS = [null, null, null];
var selectedM = [null, null, null];
var selected = [null, null, null];
var targeted = [null, null, null];
var marched = [];
var fortified = [null, null, null];
var boardPieces = [
['.','.','.','.','.','.'],
['.','.','.','.','.'],
['.','.','.','.','.','.'],
['.','.','.','.','.','.','.'],
['.','.','.','.','.','.'],
['.','.','.','.','.'],
['.','.','.','.','.','.']
];
var boardTiles = [
['w','f','e','w','e','e'],
['f','w','f','a','a'],
['w','a','w','f','e','f'],
['s','a','e','a','e','a','m'],
['f','e','f','w','a','w'],
['a','a','f','w','f'],
['e','e','w','e','f','w']
];
var currentPlayer = 'None';
var currentStep = 'Deploy';
var sunReady = false;
var moonReady = false;

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

	//Display the initial board
	update();

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
		if (currentStep !== 'Pray' && currentStep !== 'Rearm and Pray') {
			return;
		}
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
		currentStep = 'March';
		update();
	});

	socketHandle.on('selectIcon', function(data) {
		//console.log("selectIcon running");
		if (currentStep === 'Deploy') {
			if (objectClients[socketHandle.id].army == 'Sun') {
				if (selectedS[0] === data.icon) {
					selectedS[0] = null;
				} else {
					selectedS[0] = data.icon;
				}
			} else {
				if (selectedM[0] === data.icon) {
					selectedM[0] = null;
				} else {
					selectedM[0] = data.icon;
				}
			}
		} else if (currentStep === 'Rearm and Pray' && currentPlayer === objectClients[socketHandle.id].army) {
			if (currentPlayer === 'Sun') {
				var cityUnit = boardPieces[3][0];
				if (data.icon === 'sa' && countUnit('A') < 3) {
					boardPieces[3][0] = 'A';
				} else if (data.icon === 'sh' && countUnit('H') < 3) {
					boardPieces[3][0] = 'H';
				} else if (data.icon === 'ss' && countUnit('S') < 3) {
					boardPieces[3][0] = 'S';
				} else if (data.icon === 'sw' && countUnit('W') < 3) {
					boardPieces[3][0] = 'W';
				}
				if (cityUnit !== boardPieces[3][0]) {
					marched.unshift(boardPieces[3][0], 3, 0);
				}
			} else {
				var cityUnit = boardPieces[3][6];
				if (data.icon === 'ma' && countUnit('a') < 3) {
					boardPieces[3][6] = 'a';
				} else if (data.icon === 'mh' && countUnit('h') < 3) {
					boardPieces[3][6] = 'h';
				} else if (data.icon === 'ms' && countUnit('s') < 3) {
					boardPieces[3][6] = 's';
				} else if (data.icon === 'mw' && countUnit('w') < 3) {
					boardPieces[3][6] = 'w';
				}
				if (cityUnit !== boardPieces[3][6]) {
					marched.unshift(boardPieces[3][6], 3, 6);
				}
			}
		}
		update();
	});

	socketHandle.on('tapBoard', function(data) {
		if (data.row < 0 || data.row > 6 || data.tile < 0 || data.tile > (5 - data.row % 2 + Math.max(0, data.row % 4 - 2) * 2)) {
			//console.log("Clicked outside the hexes");
			selected[0] = null;
			selected[1] = null;
			selected[2] = null;
			targeted[0] = null;
			targeted[1] = null;
			targeted[2] = null;
			update();
			return;
		}
		if (currentStep === 'Deploy') {
			if (objectClients[socketHandle.id].army == 'Sun') {
				if (data.tile > 1 || ((data.row === 1 || data.row === 5) && data.tile > 0)) {
					return;
				}
				if (selectedS[0] === 'sa' && countUnit('A') < 3) {
					boardPieces[data.row][data.tile] = 'A';
				} else if (selectedS[0] === 'sh' && countUnit('H') < 3) {
					boardPieces[data.row][data.tile] = 'H';
				} else if (selectedS[0] === 'ss' && countUnit('S') < 3) {
					boardPieces[data.row][data.tile] = 'S';
				} else if (selectedS[0] === 'sw' && countUnit('W') < 3) {
					boardPieces[data.row][data.tile] = 'W';
				}
			} else { 
				if (data.tile < 4 || ((data.row === 3) && data.tile < 5)) {
					return;
				}
				if (selectedM[0] === 'ma' && countUnit('a') < 3) {
					boardPieces[data.row][data.tile] = 'a';
				} else if (selectedM[0] === 'mh' && countUnit('h') < 3) {
					boardPieces[data.row][data.tile] = 'h';
				} else if (selectedM[0] === 'ms' && countUnit('s') < 3) {
					boardPieces[data.row][data.tile] = 's';
				} else if (selectedM[0] === 'mw' && countUnit('w') < 3) {
					boardPieces[data.row][data.tile] = 'w';
				}
			} 
		} else if (currentStep === 'March' && currentPlayer === objectClients[socketHandle.id].army) {
			if (validateMove(data.row, data.tile, objectClients[socketHandle.id].army)) {
				executeMove(data.row, data.tile);
			} else if (validateTarget(data.row, data.tile, objectClients[socketHandle.id].army)) {
				targeted[0] = boardPieces[data.row][data.tile];
				targeted[1] = data.row;
				targeted[2] = data.tile;
			} else if (validateSelection(data.row, data.tile, objectClients[socketHandle.id].army)) {
				selected[0] = boardPieces[data.row][data.tile];
				selected[1] = data.row;
				selected[2] = data.tile;
				targeted[0] = null;
				targeted[1] = null;
				targeted[2] = null;
			} else {
				selected[0] = null;
				selected[1] = null;
				selected[2] = null;
				targeted[0] = null;
				targeted[1] = null;
				targeted[2] = null;
			}
		} 
		update();
	});

	socketHandle.on('endTurn', function() {
		if (currentStep === "Deploy") {
			if (objectClients[socketHandle.id].army === "Sun") {
				sunReady = true;
			} else {
				moonReady = true;
			}
			if (!sunReady || !moonReady) {
				update();
				return;
			} else {
				selectedS[0] = null;
				selectedM[0] = null;
			}
		}
		if (currentPlayer === "Sun") {
			currentPlayer = "Moon";
		} else {
			currentPlayer = "Sun";
		}
		currentStep = "March";
		selected[0] = null;
		selected[1] = null;
		selected[2] = null;
		targeted[0] = null;
		targeted[1] = null;
		targeted[2] = null;
		if (marched.length > 0) {
			fortified = marched.pop();
		} else {
			fortified = [null, null, null];
		}
		while (marched.length > 0) {
			marched.pop();
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
			'selectedS':selectedS,
			'selectedM':selectedM,
			'selected':selected,
			'targeted':targeted,
			'fortified':fortified,
			'boardPieces':boardPieces,
			'currentPlayer':currentPlayer,
			'currentStep':currentStep,
			'army':objectClients[client].army
		});
	}
}

function countUnit(unit) {
	var count = 0;
	for (var row in boardPieces) {
		for (var tile in boardPieces[row]) {
			if (boardPieces[row][tile] === unit) {
				count++;
			}
		}
	}
	return count;
}

function validateMove(row, tile, army) {
	if (selected[0] === null) {
		return false;
	}
	if (targeted[0] !== null) {
		if (adjacent(targeted[1], targeted[2], row, tile) && boardPieces[row][tile] === '.') {
			return true;
		} else {
			return false;
		}
	}
	if (adjacent(selected[1], selected[2], row, tile)) {
		if (boardPieces[row][tile] === '.') {
			return true;
		}
		if (((/[A-W]/.test(boardPieces[row][tile])) && army === 'Moon') || ((/[a-w]/.test(boardPieces[row][tile])) && army === 'Sun')) {
			if (/[fsm]/.test(boardTiles[row][tile])) {
				return true;
			}
			if ((/[Ww]/.test(selected[0])) && !(/[Ss]/.test(boardPieces[row][tile])) && !(/[e]/.test(boardTiles[row][tile]))) {
				return true;
			}
		}
	}
	return false;
}

function executeMove(row, tile) {
	if (targeted[0] !== null) {
		boardPieces[row][tile] = boardPieces[targeted[1]][targeted[2]];
		for (var unit in marched) {
			if (marched[unit][1] === targeted[1] && marched[unit][2] === targeted[2]) {
				marched[unit][1] = row;
				marched[unit][2] = tile;
			}
		}
		boardPieces[targeted[1]][targeted[2]] = boardPieces[selected[1]][selected[2]];
	} else {
		if(/[sm]/.test(boardTiles[row][tile]) && boardPieces[row][tile] !== '.') {
			boardPieces[selected[1]][selected[2]] = '.';
		} 
		boardPieces[row][tile] = boardPieces[selected[1]][selected[2]];
	}
	boardPieces[selected[1]][selected[2]] = '.';
	if (winner() !== 'none') {
		currentStep = winner();
	} else if ((/[s]/.test(boardTiles[row][tile]) && currentPlayer === 'Sun') || (/[m]/.test(boardTiles[row][tile]) && currentPlayer === 'Moon')) {
		currentStep = 'Rearm and Pray';
	} else if (targeted[0] !== null) {
		if ((/[s]/.test(boardTiles[targeted[1]][targeted[2]]) && currentPlayer === 'Sun') || (/[m]/.test(boardTiles[targeted[1]][targeted[2]]) && currentPlayer === 'Moon')) {
			currentStep = 'Rearm and Pray';
		} else {
			currentStep = 'Pray';	
		}
	} else {
		currentStep = 'Pray';
	}
	var marchedUnit = [null, null, null];
	if (targeted[0] !== null) {
		marchedUnit[0] = selected[0];
		marchedUnit[1] = targeted[1];
		marchedUnit[2] = targeted[2];
	} else {
		marchedUnit[0] = selected[0];
		marchedUnit[1] = row;
		marchedUnit[2] = tile;
	}
	marched.push(marchedUnit);
	selected[0] = null;
	selected[1] = null;
	selected[2] = null;
	targeted[0] = null;
	targeted[1] = null;
	targeted[2] = null;
}

function validateTarget(row, tile, army) {
	if (adjacent(selected[1], selected[2], row, tile)) {
		if (selected[0] === 'A' || selected[0] === 'a' || boardTiles[row][tile] === 'w') {
			if (((/[A-W]/.test(boardPieces[row][tile])) && army === 'Moon') || ((/[a-w]/.test(boardPieces[row][tile])) && army === 'Sun')) {
				if (row !== fortified[1] || tile !== fortified[2]) {
					return true;
				}
			}
		}
		if (selected[0] === 'H' || selected[0] === 'h' || boardTiles[row][tile] === 'a') {
			if (((/[A-W]/.test(boardPieces[row][tile])) && army === 'Sun') || ((/[a-w]/.test(boardPieces[row][tile])) && army === 'Moon')) {
				return true;
			}
		}
	}
	return false;
}

function validateSelection(row, tile, army) {
	if (((/[A-W]/.test(boardPieces[row][tile])) && army === 'Sun') || ((/[a-w]/.test(boardPieces[row][tile])) && army === 'Moon')) {
		for (var unit in marched) {
			if (marched[unit][1] === row && marched[unit][2] === tile) {
				return false;
			}
		}
		return true;
	}
	return false;
}

function adjacent(r1, t1, r2, t2) {
	if (r1 === r2 && Math.abs(t1-t2) === 1) {
		return true;
	}
	if (Math.abs(r1-r2) === 1) {
		if (r1 === 0 || r1 === 3 || r1 === 6) {
			if (t1 === t2 || t1 === t2 + 1) {
				return true;
			}
		}
		if (r1 === 1 || r1 === 5) {
			if (t1 === t2 || t1 === t2 - 1) {
				return true;
			}
		}
		if (r1 === 2) {
			if (r2 === 1) {
				if (t1 === t2 || t1 === t2 + 1) {
					return true;
				}
			} else {
				if (t1 === t2 || t1 === t2 - 1) {
					return true;
				}
			}
		}
		if (r1 === 4) {
			if (r2 === 5) {
				if (t1 === t2 || t1 === t2 + 1) {
					return true;
				}
			} else {
				if (t1 === t2 || t1 === t2 - 1) {
					return true;
				}
			}
		}
	}
	return false;
}

function winner() {
	var sunWin = false;
	var moonWin = false;
	if (/[A-W]/.test(boardPieces[3][6]) || ((countUnit('a') + countUnit('h') + countUnit('s') + countUnit('w')) === 0)) { 
		sunWin = true;
	}
	if (/[a-w]/.test(boardPieces[3][0]) || ((countUnit('A') + countUnit('H') + countUnit('S') + countUnit('W')) === 0)) { 
		moonWin = true;
	}
	if (sunWin && moonWin) {
		return 'Draw';
	}
	if (sunWin) {
		return 'Sun Victory';
	}
	if (moonWin) {
		return 'Moon Victory';
	}
	return 'none';
}

console.log('go ahead and open "http://localhost:8080/shoku.html" in your browser');
