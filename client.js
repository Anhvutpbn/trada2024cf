import { GameMap } from './machineAi.js';
import { GameMapChild } from './child.js';
const gameId = '9f1f5e14-70c7-412c-887e-ddefe4bcccc0';

// client.js
import { connect } from 'socket.io-client';
const apiServer = 'http://192.168.1.96';
const socket = connect(apiServer, {reconnect: true, transports: ['websocket']});
const playerId = 'player1-xxx';
const optionJoin = {game_id: gameId, player_id: "player1-xxx"}

// It it required to emit `join channel` event every time connection is happened
socket.on('connect', () => {

    // API-1a
    socket.emit('join game', optionJoin);
});

socket.on('disconnect', () => {
    console.warn('[Socket] disconnected');
});

socket.on('connect_failed', () => {
    console.warn('[Socket] connect_failed');
});


socket.on('error', (err) => {
    console.error('[Socket] error ', err);
});


// SOCKET EVENTS

// API-1b
socket.on('join game', (res) => {
    console.log('[Socket] join-game responsed', res);
    socket.emit('register character power', {
        "gameId": gameId,
        "type": 1,
    })
});



const gameMap = new GameMap(socket, playerId);
const gameMapChild = new GameMapChild(socket, playerId)
//API-2
socket.on('ticktack player', (res) => {
    gameMap.parseTicktack(res);
    gameMapChild.parseTicktack(res);
});
