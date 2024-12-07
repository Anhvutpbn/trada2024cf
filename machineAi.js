import { MAP_CELL, MOVE_DIRECTION, EVENT_GAME } from './config.js';
const START_GAME = "start-game";
const UPDATE_GAME = "update-data";
const MOVING_BANNED = "player:moving-banned";
const STOP_MOVING = "player:stop-moving";
const BE_ISOLATED = "player:be-isolated";
const BTPG = "player:back-to-playground";
const BOMB_EXPLODED = "bomb:exploded";
const STUN = "player:stun-by-weapon";
const EMIT_COUNT_DOWN = 300;

class TreeNode {
    constructor(val, dir = null, parent = null) {
        this.val = val;
        this.dir = dir;
        this.parent = parent;
        this.children = [];
        this.distance = parent ? parent.distance + 1 : 0;
    }
}

class GamePlayer {
    constructor(gameMap, playerInfo) {
        this.position = gameMap.playerPosition(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
        this.playerInfo = playerInfo;
    }

    setPlayerInfo(playerInfo) {
        this.playerInfo = playerInfo;
    }

    setPosition(gameMap, playerInfo) {
        this.position = gameMap.playerPosition(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
    }
}

class GameMap {
    constructor(playerId) {
        this.playerId = playerId;
        this.playerIdChill = playerId + "_child";
        this.map = [];
        this.flatMap = [];
        this.mapWidth = 45;
        this.mapHeight = 14;
        this.player = null;
        this.bombs = [];
        this.spoils = [];
        this.bombsPosition = [];
        this.emitStatus = false;
        this.isMoving = false;
        this.isBreaking = false;
        this.currentTarget = null;
        this.isWaitingAtGodBadge = false;
        this.lastMoveTime = Date.now();
        this.lastPosition = null;
        this.awayFromBom = false;
        this.caculatorResetTime = 0;
        this.parentSkill = true;
        this.childSkill = true;
        this.marry = false;
        this.oldBomb = {};
    }

    async parseTicktack(res) {
        try {
            // Reduce data processing by extracting only necessary parts
            this.mapWidth = res.map_info.size.cols;
            this.mapHeight = res.map_info.size.rows;
            this.map = res.map_info.map;
            this.spoils = res.map_info.spoils;

            const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
            if (!currentPlayer) return null;

            // Update enemy positions on the map
            const enemies = res.map_info.players.filter(p => p.id !== this.playerId && p.id !== this.playerIdChill);
            enemies.forEach(enemy => {
                if (enemy?.currentPosition) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MAP_CELL.ENEMY;
                }
            });

            if (this.player) {
                this.player.setPlayerInfo(currentPlayer);
                this.player.setPosition(this, currentPlayer);
            } else {
                this.player = new GamePlayer(this, currentPlayer);
            }

            if (!this.player.playerInfo.hasTransform) {
                if (res.tag === STOP_MOVING && res.player_id === this.playerId) {
                    if (this.hasValueThree(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col)) {
                        this.isMoving = false;
                        return { type: EVENT_GAME.RUNNING, path: "b" };
                    }
                }

                const findPathStoppingAtThree = this.findPathStoppingAtThree(this.map, [currentPlayer.currentPosition.row, currentPlayer.currentPosition.col]);
                if (findPathStoppingAtThree.type === 1 || !this.isMoving) {
                    this.isMoving = true;
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path };
                }
                if (findPathStoppingAtThree.type === 2 || !this.isMoving) {
                    this.isMoving = true;
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path };
                }
                if (findPathStoppingAtThree.type === 3 || !this.isMoving) {
                    this.isMoving = true;
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                }
            }

            if (!this.marry && this.player.playerInfo.eternalBadge > 0) {
                this.marry = true;
                return;
            }

            return "VUTA";
        } catch (error) {
            console.error("Error in parseTicktack:", error);
        } finally {
            // Cleanup large objects
            res = null;
        }
    }

    playerPosition(x, y) {
        return { row: x, col: y };
    }

    printMap2DV2(map) {
        console.log("Current Map:");
        for (let y = 0; y < map.length; y++) {
            let row = map[y].join(' ');
            console.log(row);
        }
    }

    findPathStoppingAtThree(grid, start) {
        const directions = [
            [1, 0, '4'],
            [0, -1, '1'],
            [0, 1, '2'],
            [-1, 0, '3'],
        ];

        const isValid = (x, y, visited) => {
            const rows = grid.length;
            const cols = grid[0].length;
            return (
                x >= 0 &&
                x < rows &&
                y >= 0 &&
                y < cols &&
                !visited[x][y] &&
                (grid[x][y] === 0 || grid[x][y] === 3 || grid[x][y] === 6)
            );
        };

        const queue = [[start[0], start[1], []]];
        const visited = Array.from({ length: grid.length }, () => new Uint8Array(grid[0].length));
        visited[start[0]][start[1]] = 1;

        while (queue.length > 0) {
            const [x, y, path] = queue.shift();

            if (grid[x][y] === 6) {
                const stoppingPath = [...path];
                return { type: 2, path: stoppingPath.join('') };
            }

            for (const [dx, dy, action] of directions) {
                const nx = x + dx;
                const ny = y + dy;

                if (isValid(nx, ny, visited)) {
                    queue.push([nx, ny, [...path, action]]);
                    visited[nx][ny] = 1;
                }
            }
        }

        return { type: 3, path: null };
    }

    hasValueThree(x, y) {
        return (
            this.map[x + 1]?.[y] === MAP_CELL.BRICK_WALL ||
            this.map[x - 1]?.[y] === MAP_CELL.BRICK_WALL ||
            this.map[x]?.[y + 1] === MAP_CELL.BRICK_WALL ||
            this.map[x]?.[y - 1] === MAP_CELL.BRICK_WALL
        );
    }
}

export { GameMap };
