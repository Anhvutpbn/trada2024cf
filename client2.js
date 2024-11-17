const gameId = '5bdfa5d1-eecd-4d2d-81b2-bc8d98ccc101';


let MAP = {};
let BOMB = [];
let SPOILS = [];
let currentMap = {};
let players;


// client.js
const io = require('socket.io-client');
const apiServer = 'http://192.168.1.177';
const socket = io.connect(apiServer, {reconnect: true, transports: ['websocket']});
const playerId = '9728f232-51e9';
const optionJoin = {game_id: gameId, player_id: "player2-xxx"}

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
// Ví dụ như sau. Sẽ cần update theo Spec API mới nhất
let start = false;
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

// Nhân vật ( 4 Nhân Vật )
const PLAYER_TYPE = []

// Vật phẩm trong game để + - điểm hoặc nâng cấp 
const COM_NEP = 10
const BANH_CHUNG = 11
const VOI_CHIN_NGA = 12
const GA_CHIN_CUA = 13
const NGUA_CHIN_LMAO = 14
const LINH_THACH = 15
const HUY_HIEU_THAN = 16
const HUY_HIEU_VINH_CUU = 17

// Vật phẩm cơ bản xuất hiện bắt đầu game
const BOX_GO = 1
const TUONG_GACH = 2
const TUONG_DA = 3
const TUONG_CHAN = 4
const CUNG_DIEN_MY_NUONG = 5
const DIA_LAO = 6

// Vu khi
// tobecon tình yêu


//API-2
socket.on('ticktack player', (res) => {
   console.log(res)
    for (let row = 0; row < res.map_info.map.length; row++) {
        console.log(res.map_info.map[row].join(' '));
    }
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
    // 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
    // 1 0 0 3 3 0 3 0 0 0 0 0 0 0 0 0 0 0 0 3 0 3 3 0 0 1
    // 1 0 1 3 2 2 2 2 2 2 0 2 2 2 2 0 2 2 2 2 2 2 3 1 0 1
    // 1 0 2 1 0 0 0 2 2 0 0 2 2 2 2 0 0 0 2 0 0 0 1 2 0 1
    // 1 0 2 2 1 5 0 2 2 0 2 1 1 1 1 2 0 0 2 0 5 1 2 2 0 1
    // 1 0 0 2 2 1 2 2 2 0 2 1 2 2 1 2 0 0 2 2 1 2 2 0 0 1
    // 1 0 0 0 2 3 2 2 0 0 2 2 2 2 2 2 0 0 2 2 3 2 0 0 0 1
    // 1 0 0 0 3 0 3 3 0 0 2 6 0 0 6 2 0 0 3 3 0 3 0 0 0 1
    // 1 0 0 2 2 1 2 2 0 2 2 0 0 0 0 2 2 0 2 2 1 2 2 0 0 1
    // 1 0 2 2 1 5 0 2 0 2 2 0 0 0 0 2 2 0 2 0 5 1 2 2 0 1
    // 1 0 2 1 0 0 0 0 0 3 3 0 3 3 0 3 3 0 0 0 0 0 1 2 0 1
    // 1 0 1 2 2 2 2 2 0 2 2 2 0 0 2 2 2 0 2 2 2 2 2 1 0 1
    // 1 0 0 3 0 3 0 3 0 0 0 0 0 0 0 0 0 0 3 0 3 0 3 0 0 1
    // 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
});
