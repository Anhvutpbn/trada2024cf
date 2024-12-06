import { parentPort } from 'worker_threads';
import { GameMap } from './machineAi.js';
import { GameMapChild } from './child.js';

parentPort.on('message', async ({ task, data }) => {
    try {
        if (task === 'gameMap') {
            console.log('[Worker] Received task for GameMap');
            const gameMap = new GameMap(data.playerId);
            const result = await gameMap.parseTicktack(data.res);
            parentPort.postMessage({ task, result });
        } else if (task === 'gameMapChild') {
            console.log('[Worker] Received task for GameMapChild');
            const gameMapChild = new GameMapChild(data.playerId);
            const result = await gameMapChild.parseTicktack(data.res);
            parentPort.postMessage({ task, result });
        } else {
            throw new Error(`Unknown task: ${task}`);
        }
    } catch (error) {
        console.error(`[Worker] Error while processing task "${task}":`, error);
        parentPort.postMessage({ task, error: error.message });
    }
});
