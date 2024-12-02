import {MapCell, MoveDirection, TreeNode, GamePlayer, GameMap } from './machineAi.js';
const gameId = '6c9d0489-c3e1-4796-86cf-cbca0249ee8b';
let MAP = {};
let BOMB = [];
let SPOILS = [];
let currentMap = {};
let players;


// client.js
import { connect } from 'socket.io-client';
const apiServer = 'http://192.168.1.69';
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
//API-2
socket.on('ticktack player', (res) => {
    gameMap.parseTicktack(res);
});
