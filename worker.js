import { parentPort } from 'worker_threads';
import { GameMap } from './machineAi.js';
import { GameMapChild } from './child.js';

// Tạo các instance sẵn
let gameMap = null;
let gameMapChild = null;

parentPort.on('message', async ({ task, data }) => {
    try {
        if (task === 'gameMap') {
            
            
            try {
                if (!gameMap) {
                    gameMap = new GameMap(data.playerId);
                }
                const result = await gameMap.parseTicktack(data.res);
                parentPort.postMessage({ task, result });
            } finally {
                console.log("______RESTART______")
                gameMap.resetState()
            }
        } else if (task === 'gameMapChild') {
            // console.log('[Worker] Processing task for GameMapChild');
            // Tạo instance nếu chưa có
            // if (!gameMapChild) {
            //     gameMapChild = new GameMapChild(data.playerId);
            // }
            // const result = await gameMapChild.parseTicktack(data.res);
            parentPort.postMessage({ task });
        } else {
            throw new Error(`Unknown task: ${task}`);
        }
    } catch (error) {
        console.error(`[Worker] Error while processing task "${task}":`, error);
        parentPort.postMessage({ task, error: error.message });
    }
});
