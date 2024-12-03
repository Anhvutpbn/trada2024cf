import {MapCell, MoveDirection, TreeNode, GamePlayer, GameMap } from './machineAi.js';
const gameId = '7dcef7a5-27c3-48a4-8848-45a9ccaa4249';
let MAP = {};
let BOMB = [];
let SPOILS = [];
let currentMap = {};
let players;


// client.js
import { connect } from 'socket.io-client';
const apiServer = 'http://192.168.0.111:3000';
const socket = connect(apiServer, {reconnect: true, transports: ['websocket']});
const playerId = 'eb59a5f9-6889';
const optionJoin = {game_id: gameId, player_id: "eb59a5f9-6889-4750-8565-e1c861c958fe"}

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
//API-2
socket.on('ticktack player', (res) => {
    gameMap.parseTicktack(res);
});
