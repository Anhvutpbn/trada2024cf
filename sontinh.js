import { connect } from 'socket.io-client';
import { GameMap } from './machineAi.js';
import { GameMapChild } from './child.js';
import { SERVER_CONFIG, EVENT_GAME, SOCKET_EVENTS } from './config.js';

const socket = connect(SERVER_CONFIG.API_SERVER, SERVER_CONFIG.SOCKET_OPTIONS);
const optionJoin = { game_id: SERVER_CONFIG.GAME_ID, player_id: SERVER_CONFIG.PLAYER_ID_JOIN_GAME};
const playerId = SERVER_CONFIG.PLAYER_ID
const gameId =  SERVER_CONFIG.GAME_ID

// Kết nối socket
socket.on('connect', () => {
    socket.emit('join game', optionJoin);
    console.log('[Socket] Connected to the server');
});

socket.on('disconnect', () => {
    console.warn('[Socket] Disconnected');
});

socket.on('connect_failed', () => {
    console.warn('[Socket] Connection failed');
});

socket.on('error', (err) => {
    console.error('[Socket] Error:', err);
});

// Nhận phản hồi từ server khi tham gia game
socket.on('join game', (res) => {
    console.log('[Socket] Join-game response:', res);
    socket.emit('register character power', {
        gameId,
        type: 1,
    });
});


const gameMap = new GameMap(socket, playerId);
const gameMapChild = new GameMapChild(socket, playerId)
socket.on('ticktack player', (res) => {

    gameMap.handleTicktack(res);
    gameMapChild.handleTicktack(res);
       
});
