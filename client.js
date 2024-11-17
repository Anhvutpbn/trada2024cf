import {MapCell, MoveDirection, TreeNode, GamePlayer, GameMap } from './machineAi.js';
const gameId = '033b5e51-5b10-4fdd-a5d0-55ec28f41649';


let MAP = {};
let BOMB = [];
let SPOILS = [];
let currentMap = {};
let players;


// client.js
import { connect } from 'socket.io-client';
const apiServer = 'http://192.168.1.177';
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
});


// CONST cho tat ca cac event của game được gửi về quả ticktack

const jsonData = {
    "words": [
        "I need money!",
        "R - U - N",
        "Ready?",
        "Try me!",
        "Show up!",
        "Dare you!",
        "Here now!",
        "Prove it!",
        "Bring it!",
        "Watch me!",
        "What's up?",
        "La La La La La La La!",
        "Xin dung giet toi",
        "cut 1/2 sadness",
        "Win yet?",
        "WDC"
    ]
};
const START_GAME = "start-game"
const UPDATE_GAME = "update-data"
const MOVING_BANNED = "player:moving-banned"
const START_MOVING = "player:start-moving"
const STOP_MOVING = "player:stop-moving"
const BE_ISOLATED = "player:be-isolated"
const BTPG = "player:back-to-playground"

// Vu khi
// tobecon tình yêu

const gameMap = new GameMap(socket, playerId);
//API-2
socket.on('ticktack player', (res) => {
//    console.log(res)
    gameMap.parseTicktack(res.id, res);
   /**
    * Từ res sẽ lấy ra các thông số của game. hiện tại cần 1 số thông số sau
    * - Lấy vị trí đứng của player ( x-y)
    * - Lấy vị trí các vùng nguy hiểm ( cần bàn luận như thế nào là nguy hiểm )
    *  + Nếu trùng hoặc sát với bản thân player cần né tránh trước
    * - Lấy vị trí của các hộp gỗ gần mình nhất ( khoảng cách quét sẽ bàn luận )
    * - Lấy vị trí các vật phẩm gần mình nhất ( khoảng cách sẽ bàn luận )
    *   + Cần function để tính toán ưu tiên ăn vật phẩm nào trước
    * - Tìm đường đến vật phẩm / hộp gỗ / điểm né tránh nguy hiểm gần nhất
    * - 
    */

});
