import { connect } from 'socket.io-client';
import { Worker } from 'worker_threads';
import { SERVER_CONFIG, EVENT_GAME, SOCKET_EVENTS } from './config.js';

const socket = connect(SERVER_CONFIG.API_SERVER, SERVER_CONFIG.SOCKET_OPTIONS);
const optionJoin = { game_id: SERVER_CONFIG.GAME_ID, player_id: SERVER_CONFIG.PLAYER_ID_JOIN_GAME};
const playerId = SERVER_CONFIG.PLAYER_ID
const gameId =  SERVER_CONFIG.GAME_ID

// Hàm chạy tác vụ trên Worker Thread
const runWorkerTask = (task, data) => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./worker.js', import.meta.url));
        worker.postMessage({ task, data });

        worker.on('message', (result) => {
            resolve(result);
        });
        worker.on('error', (err) => {
            reject(err);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
};


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

socket.on('ticktack player', async (res) => {
    try {
        const [gameMapResult, gameMapChildResult] = await Promise.all([
            runWorkerTask('gameMap', { playerId, res }),
            runWorkerTask('gameMapChild', { playerId, res }),
        ]);
        if (gameMapResult && gameMapResult.result) {
           if(gameMapResult.result.type == EVENT_GAME.RUNNING) {
            console.log(gameMapResult.result.path)
            socket.emit(
                SOCKET_EVENTS.DRIVE_PLAYER, 
                { 
                    direction: gameMapResult.result.path 
                }
            );
           }
        }

        if (gameMapChildResult && gameMapChildResult.result) {
            // socket.emit(gameMapChildResult.event, gameMapChildResult.action);
        }
    } catch (error) {
        console.error('Error running tasks:', error); // Log lỗi chi tiết
    }
});
