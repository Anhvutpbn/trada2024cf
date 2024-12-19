import { MAP_CELL, MOVE_DIRECTION, EVENT_GAME, SOCKET_EVENTS } from './config.js';
import { CommonFunction } from './common.js'
const START_GAME = "start-game";
const UPDATE_GAME = "update-data";
const MOVING_BANNED = "player:moving-banned";
const STOP_MOVING = "player:stop-moving";
const BE_ISOLATED = "player:be-isolated";
const BTPG = "player:back-to-playground";
const BOMB_EXPLODED = "bomb:exploded";
const STUN = "player:stun-by-weapon";
const CHAYGO = "wooden-pestle:setup"
const EMIT_COUNT_DOWN = 300;

const commonFunction = new CommonFunction;
const directionsSW = {
    1: { dr: 0, dc: -1 }, // Trái
    2: { dr: 0, dc: 1 },  // Phải
    3: { dr: -1, dc: 0 }, // Lên
    4: { dr: 1, dc: 0 },  // Xuống
};

class GamePlayer {
    constructor(gameMap, playerInfo) {
        this.position = gameMap.playerPosition(playerInfo.currentPosition.row, playerInfo.currentPosition.col);
        this.playerInfo = playerInfo;
    }

    setPlayerInfo(playerInfo) {
        this.playerInfo = playerInfo;
    }

    setPosition(gameMap, playerInfo) {
        this.position = gameMap.playerPosition(playerInfo.currentPosition.row, playerInfo.currentPosition.col);
    }
}

class GameMap {
    constructor(socket, playerId) {
        this.socket = socket;
        this.playerId = playerId;
        this.playerIdChill = playerId+"_child";
        this.map = [];
        this.mapWidth = 45;
        this.mapHeight = 14;
        this.player = null;
        this.bombs = [];
        this.spoils = [];
        this.bombsPosition = [];
        this.isWaitingAtGodBadge = false;
        this.enemyTransform = false;
        this.parentSkill = true;
        this.marry = false;
        this.powerPlayer = 1;
        this.canKillAfterStun = 0
    }

    handleTicktack(res) {
        setImmediate(() => {
            try {
                this.parseTicktack(res);
                console.log("[GameMap] Error in parseTicktack:");
            } catch (error) {
                console.error("[GameMap] Error in parseTicktack:", error);
            }
        });
    }
    
    async checkingGameStatus(res) {
        try {
            // Reduce data processing by extracting only necessary parts
            this.mapWidth = res.map_info.size.cols;
            this.mapHeight = res.map_info.size.rows;
            this.map = res.map_info.map;
            this.spoils = res.map_info.spoils;

            const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
            if (!currentPlayer) {
                console.log("--- exeption")
            };

            // Update enemy positions on the map
            const enemies = res.map_info.players.filter(p => p.id !== this.playerId && p.id !== this.playerIdChill);
            enemies.forEach(enemy => {
                if (enemy?.currentPosition && enemies.length >=2 ) {
                    const { row, col } = enemy.currentPosition;
                    // Đặt vị trí hiện tại của enemy là MAP_CELL.ENEMY
                    this.map[row][col] = MAP_CELL.ENEMY;
                }
                if (enemy?.currentPosition && enemies.length == 1 &&  enemy?.hasTransform) {
                    const { row, col } = enemy.currentPosition;
                    // Đặt vị trí hiện tại của enemy là MAP_CELL.ENEMY
                    this.map[row][col] = MAP_CELL.ENEMY;
                } 
                if (enemy?.currentPosition && enemies.length == 1 &&  !enemy?.hasTransform) {
                    const { row, col } = enemy.currentPosition;
                    this.map[row][col] = MAP_CELL.BORDER;
                }
            });
            const nonChildEnemies = enemies.find(enemy => !enemy.id.endsWith('_child'));

            if(nonChildEnemies !== undefined && nonChildEnemies &&nonChildEnemies.hasTransform) {
                this.enemyTransform = true
            }

            if (this.player) {
                this.player.setPlayerInfo(currentPlayer);
                this.player.setPosition(this, currentPlayer);
            } else {
                this.player = new GamePlayer(this, currentPlayer);
            }

            if(!this.marry && currentPlayer.eternalBadge > 0 && res.gameRemainTime <= 120 ) {
                this.socket.emit('action', {
                    "action": "marry wife"						
                })
                this.marry = true						
            }
            

            if (!this.player.playerInfo.hasTransform) {

                // Đang đứng ở huy hiệu thần thì đợi. 
                if(this.map[currentPlayer.currentPosition.row][currentPlayer.currentPosition.col] === MAP_CELL.GOD_BADGE) {
                    return { type: EVENT_GAME.WAIT_GOD_BAGDE, path: null , tick: "GOD BADGE"};
                }
                // Kiem tra da dung chay go thi chuyen status de di chuyen
                if(res.tag == CHAYGO && res.player_id === this.playerId) {
                 this.isMoving = false
                 return { type: EVENT_GAME.NO_ACTION, path: null, tick: 0 };
                }

                if (res.tag === STOP_MOVING && res.player_id === this.playerId) {
                    if (this.hasValueThree(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col)) {
                        this.isMoving = true;
                        return { type: EVENT_GAME.RUNNING, path: "b" };
                    }
                }

                const findPathStoppingAtThree = this.findPathStoppingAtThree(this.map, [currentPlayer.currentPosition.row, currentPlayer.currentPosition.col]);
                if (findPathStoppingAtThree.type === EVENT_GAME.RUNNING || !this.isMoving) {
                    this.isMoving = true;
                    // console.log("-tick 1")
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path , tick: 1};
                }
                if (findPathStoppingAtThree.type === EVENT_GAME.RUNNING || !this.isMoving) {
                    this.isMoving = true;
                    // console.log("-tick 2")
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path, tick: 2 };
                }
                if (findPathStoppingAtThree.type === EVENT_GAME.RUNNING || !this.isMoving) {
                    this.isMoving = true;
                    // console.log("-tick 3")
                    return { type: EVENT_GAME.NO_ACTION, path: null, tick: 3 };
                }

                if (!this.hasValueThree(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col)) {
                    this.isMoving = false
                    console.log("CHAO EM CO GAI LAM HONG")
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                }
            }
            
            this.addBombs(res.map_info.bombs)
            this.removeExpiredBombs()
            this.replaceBombExplosionOnMap()

            if(res.map_info.weaponHammers.length > 0) {
                this.updateMapWithICBM(res.map_info.weaponHammers, MAP_CELL.BOMB_ZONE)
            }

            // this.printMap2DV2(this.map)
            
             
            // Neu dang trong vung bomb thi ne
            if(this.map[currentPlayer.currentPosition.row][currentPlayer.currentPosition.col] == MAP_CELL.BOMB_ZONE) {
                const runningPath = this.findEscapePath(this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col))
                if(runningPath) {
                    return { type: EVENT_GAME.RUNNING, path: runningPath, tick: "RUN BOMB AWAY" };
                } else {
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                }
            }
            
            // Kiem tra neu co bua tren ban do thi di nhat
            const weaponPlaces = res.map_info.weaponPlaces.find(p => this.playerId == p.playerId);
            if(weaponPlaces) {
                const pathToGetWeapon = this.findPathWeaponDroped(this.map, [currentPlayer.currentPosition.row, currentPlayer.currentPosition.col], weaponPlaces)
                if(pathToGetWeapon.path) {
                    return { type: EVENT_GAME.RUNNING, path: pathToGetWeapon.path, tick: "RUN TO GET WEAPON" };
                }
                // Vu khi dang roi
            }

            // Kiem tra neu gan dich thi trien khai combo. Doi vu  khi. Dap choang
            // Neu dung gan dich trong khoang 2 o thi doi vu khi sang 1. Sau do tiep can va dap choang. Neu player enemy bi choang. Se doi vu khi sang 2 va tha bomb. Neu cach nhau 3 o se doi lai vu khi sang bomb. Neu o gan 2 player thi khong doi vu khi. 

            if(res.tag == "player:stun-by-weapon" && res.player_id != this.playerId && res.player_id != this.playerIdChill) {
                this.canKillAfterStun = Date.now()
                if(currentPlayer.currentWeapon !== 2) {
                    await this.socket.emit('action', { action: "switch weapon" });
                }
                const pathMove = this.moveTwoStepsRandomly(this.map, this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col))
                return { type: EVENT_GAME.RUNNING, path: pathMove.path, tick: "Run  away" };
            }
            
            // Đánh giá tình hình. Nếu đứng Gần địch thì Ném vũ khí thần. Trong khoảng 3-5 ô
            const checkCanUseSpecialWeapon = this.findEnemiesWithinRange(this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col), enemies);

            if(
                checkCanUseSpecialWeapon.canShot &&
                this.player.playerInfo.timeToUseSpecialWeapons > 0 &&
                this.enemyTransform &&
                this.parentSkill
            )
            {
                return { type: EVENT_GAME.USE_SPECIAL_SKILL, path: checkCanUseSpecialWeapon.target, tick: "USE_SPECIAL_SKILL" }; 
            }



            // Kill mode
            const pathToEnemy = this.checkPathToEnemy(this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col), this.map)
            if(pathToEnemy) {

                // Kiem tra neu enemy ma stun thi dat bomb
                const stuned = enemies.find(p => p.isStun == true);
                if(stuned) {
                    if(this.isWithinRadiusKillMod(
                        this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col),
                        this.playerPosition(stuned.currentPosition.row, stuned.currentPosition.col),
                    )) {
                        const currentDateTime = Date.now()
                        const compareTime = currentDateTime - this.canKillAfterStun
                        if(currentPlayer.currentWeapon == 2) {
                            if( 900 <= compareTime  && compareTime <= 2000) {
                                this.canKillAfterStun = 0
                                return { type: EVENT_GAME.RUNNING, path: this.processString(pathToEnemy), tick: "RUN KILL MOD" };
                            } else {
                                return { type: EVENT_GAME.NO_ACTION, path: null };
                            }
                            
                        }
                    }
                }
                // Neu path =1 thi dang doi dau roi. Se chuyen sang bua va B sau do chuyen sang bomb
                if(pathToEnemy.length > 1) {
                    if(currentPlayer.currentWeapon !== 2) {
                        this.socket.emit('action', { action: "switch weapon" });
                    }
                    return { type: EVENT_GAME.RUNNING, path: pathToEnemy, tick: "RUN KILL MOD" };
                }
                
                // chuyen vu khi
                if(currentPlayer.currentWeapon == 2) {
                    this.socket.emit('action', { action: "switch weapon" });
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                } else {
                    await this.socket.emit(SOCKET_EVENTS.DRIVE_PLAYER, { direction: pathToEnemy });
                    return { type: EVENT_GAME.RUNNING, path: "b" };
                }

            } else {
                if(this.player.playerInfo.currentWeapon !== 2) {
                    this.socket.emit('action', { action: "switch weapon" });
                    // console.log("Doi Vu khi Chinh")
                    return { type: EVENT_GAME.NO_ACTION, path: null, tick: "change weapon" };
                }
            }

            const spoildPath = this.findSpoilAndPath(this.map, this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col), res.map_info.spoils)

            if(spoildPath) {
                return { type: EVENT_GAME.RUNNING, path: spoildPath.path, tick: "RUN GET PATH" };
            }
            
            // Đoạn này cần check nếu địch ở gần thì có thể đi đến đặt bomb và lùi lại. 

            // Sau khi không có địch thì ta có thể đi farm box. 
            const boxPath = this.findOptimalBombPosition(
                this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col),
                this.player.playerInfo.power,
                this.map
            )
            
            if(boxPath) {
                return { type: EVENT_GAME.BOMBED, path: boxPath, tick: "BOMBED" };
            } else {
                if (this.hasValueBALK(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col)) {
                    this.isMoving = true;
                    return { type: EVENT_GAME.BOMBED, path: "b", tick: "BOMBED" };
                }
            }

            return { type: EVENT_GAME.NO_ACTION, path: null, tick: "END" };
        } catch (error) {
            console.log(error)
            return { type: EVENT_GAME.NO_ACTION, path: null };
        } finally {
            // Cleanup large objects
            res = null;
        }
    }
    async parseTicktack(res) {
        const result = await this.checkingGameStatus(res)
        if(result.type == EVENT_GAME.RUNNING) {
            this.emitDriver(SOCKET_EVENTS.DRIVE_PLAYER, result.path)
        }
        if(result.type == EVENT_GAME.WAIT_GOD_BAGDE) {
            return;
        }

        if(result.type == EVENT_GAME.USE_SPECIAL_SKILL) {
            await this.socket.emit("action", {
                action: "use weapon",
                payload: {
                    destination: {
                        col: result.path.col,
                        row: result.path.row
                    }
                }
            });
            this.parentSkill = false
            setTimeout(() => {
                this.parentSkill = true 
            }, 7000);
        }

        
        if(result.type == EVENT_GAME.BOMBED) {
            if(commonFunction.isPlayerIdNotInArray(res.map_info.bombs, this.playerId)) {
                const bombPositionSlice = result.path ? result.path.slice(0, -1) : "";
                this.emitDriver(SOCKET_EVENTS.DRIVE_PLAYER, bombPositionSlice+"b")
            }
        }
    }

    isWithinRadiusKillMod(player1Position, player2Position, radius = 3) {
        const distance = Math.abs(player1Position.row - player2Position.row) + Math.abs(player1Position.col - player2Position.col);
        return distance <= radius;
    }

    processString(a) {
        if (!a) { 
            // Nếu a rỗng, gán a = b
            a = "b";
        } else if (a.length === 1) { 
            // Nếu a có 1 ký tự, gán a = b
            a = "b";
        } else { 
            // Nếu a có giá trị nhiều hơn 1 ký tự, thêm 'b' vào cuối
            a = a.slice(0, -1) + 'b';
        }
        return a;
    }
    playerPosition(x, y) {
        return { row: x, col: y };
    }

    printMap2DV2(map) {
        // console.log("Current Map:");
        for (let y = 0; y < map.length; y++) {
            let row = map[y].join(' ');
            console.log(row);
        }
    }
    
    async emitDriver(event, data) {
        // console.log("---status", this.isMoving, data)
        await this.socket.emit(event, { direction: data });
    }

    findPathStoppingAtThree = (grid, start) => {
        const directions = [
          [1, 0, '4'],  // Xuống
          [0, -1, '1'], // Trái
          [0, 1, '2'],  // Phải
          [-1, 0, '3'], // Lên
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
      
        const queue = [[start[0], start[1], []]]; // [row, col, path[]]
        const visited = Array.from({ length: grid.length }, () =>
          Array(grid[0].length).fill(false)
        );
        visited[start[0]][start[1]] = true;
      
        while (queue.length > 0) {
          const [x, y, path] = queue.shift();
      
          // Nếu gặp ô 6
          if (grid[x][y] === 6) {
            const fullPath = [...path, { move: null, value: 6, row: x, col: y }];
            const stoppingPath = [];
            for (const step of fullPath) {
              if (step.value === 3) {
                return { type: EVENT_GAME.RUNNING, path: stoppingPath.join('') };
              }
              if (step.move) stoppingPath.push(step.move);
            }
            return { type: EVENT_GAME.RUNNING, path: stoppingPath.join('') };
          }
      
          // Duyệt các hướng
          for (const [dx, dy, action] of directions) {
            const nx = x + dx;
            const ny = y + dy;
      
            if (isValid(nx, ny, visited)) {
              queue.push([
                nx,
                ny,
                [...path, { move: action, value: grid[x][y], row: x, col: y }],
              ]);
              visited[nx][ny] = true;
            }
          }
        }
      
        return { type: EVENT_GAME.NO_ACTION, path: null };
    };

    hasValueThree(x, y) {
        return (
            this.map[x + 1]?.[y] === MAP_CELL.BRICK_WALL ||
            this.map[x - 1]?.[y] === MAP_CELL.BRICK_WALL ||
            this.map[x]?.[y + 1] === MAP_CELL.BRICK_WALL ||
            this.map[x]?.[y - 1] === MAP_CELL.BRICK_WALL
        );
    }

    hasValueBALK(x, y) {
        return (
            this.map[x + 1]?.[y] === MAP_CELL.BALK ||
            this.map[x - 1]?.[y] === MAP_CELL.BALK ||
            this.map[x]?.[y + 1] === MAP_CELL.BALK ||
            this.map[x]?.[y - 1] === MAP_CELL.BALK
        );
    }


    // Tính toán tìm kiếm địch ở trong range Nếu có thì bắn đạn

    isWithinRange = (playerPosition, enemyPosition) => {
        const { col: playerCol, row: playerRow } = playerPosition;
        const { col: enemyCol, row: enemyRow } = enemyPosition;
      
        // Tính khoảng cách Euclidean
        const distance = Math.sqrt(
          Math.pow(playerCol - enemyCol, 2) + Math.pow(playerRow - enemyRow, 2)
        );
      
        // Kiểm tra nếu khoảng cách nằm trong khoảng [3, 5]
        return distance >= 2 && distance <= 5;
      };
      
    findEnemiesWithinRange = (playerPosition, enemies) => {
    const result = [];
    
    for (const enemy of enemies) {
        if (this.isWithinRange(playerPosition, enemy.currentPosition)) {
        return {canShot: true, target: enemy.currentPosition}
        }
        if (result.length === 2) break; // Dừng khi đã lấy đủ 2 enemy
    }
    
    return {canShot: false, target: null}
    };

    findOptimalBombPosition(position, power) {
        // Tọa độ bắt đầu
        const startRow = position.row;
        const startCol = position.col;
    
        // Tọa độ di chuyển tương ứng với MoveDirection
        const directions = [
            { dr: 0, dc: -1, move: MOVE_DIRECTION.LEFT },  // Trái
            { dr: 0, dc: 1, move: MOVE_DIRECTION.RIGHT }, // Phải
            { dr: -1, dc: 0, move: MOVE_DIRECTION.UP },   // Lên
            { dr: 1, dc: 0, move: MOVE_DIRECTION.DOWN },  // Xuống
        ];
    
        // BFS: Hàng đợi chứa các trạng thái {row, col, path, distance}
        const queue = [];
        const visited = new Set();
    
        // Thêm trạng thái bắt đầu vào hàng đợi
        queue.push({ row: startRow, col: startCol, path: "", distance: 0 });
        visited.add(`${startRow},${startCol}`); // Đánh dấu đã duyệt vị trí bắt đầu
    
    
        while (queue.length > 0) {
            const current = queue.shift();
            const { row, col, path, distance } = current;
    
            // Log trạng thái hiện tại
            // Nếu khoảng cách đến MAP_CELL.BALK <= power, trả về vị trí hiện tại
            if (this.map[row][col] == MAP_CELL.BALK || this.map[row][col] == MAP_CELL.ENEMY) {
                return path; // Trả về chuỗi các bước đi
            }
    
            // Thử tất cả hướng di chuyển
            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
    
                // Kiểm tra điều kiện hợp lệ của tọa độ mới
                if (
                    newRow >= 0 &&
                    newRow < this.map.length && // Giới hạn hàng
                    newCol >= 0 &&
                    newCol < this.map[0].length && // Giới hạn cột
                    !visited.has(`${newRow},${newCol}`) && // Chưa duyệt qua
                    (this.map[newRow][newCol] === MAP_CELL.ROAD || this.map[newRow][newCol] === MAP_CELL.BALK) && // Chỉ đi qua Road hoặc Balk
                    this.map[newRow][newCol] !== MAP_CELL.BOMB_ZONE // Không đi qua BombZone
                ) {
                    queue.push({ row: newRow, col: newCol, path: path + move, distance: distance + 1 });
                    visited.add(`${newRow},${newCol}`); // Đánh dấu vị trí đã duyệt
                }
            }
        }
    
        // Nếu không tìm thấy đường đi
        return null;
    }
    

    toFlatIndex(row, col, mapWidth) {
        return row * mapWidth + col;
    }

    addBombs(newBombs) {
        const bombMap = new Map(this.bombs.map(bomb => [bomb.createdAt, bomb])); // Tạo Map để kiểm tra nhanh hơn
    
        newBombs.forEach(newBomb => {
            if (!bombMap.has(newBomb.createdAt)) {
                const updatedBomb = {
                    ...newBomb,
                    created_date_local: Date.now(),
                };
    
                // Thêm quả bom vào mảng và Map
                this.bombs.push(updatedBomb);
                bombMap.set(newBomb.createdAt, updatedBomb);
            }
        });
    }
    
    removeExpiredBombs() {
        const currentTimestamp = Date.now();
        this.bombs = this.bombs.filter(bomb => {
            console.log(currentTimestamp - bomb.created_date_local)
            return currentTimestamp - bomb.created_date_local <= 3000; 
        });
    }
    

    replaceBombExplosionOnMap() {
        const directions = [
            { dr: 0, dc: -1 }, // Trái
            { dr: 0, dc: 1 },  // Phải
            { dr: -1, dc: 0 }, // Lên
            { dr: 1, dc: 0 },  // Xuống
        ];
    
        const blockCells = [MAP_CELL.BORDER, MAP_CELL.BRICK_WALL, MAP_CELL.JAIL, MAP_CELL.BALK, MAP_CELL.ENEMY];
    
        // Lấy thời gian hiện tại
        const currentTime = Date.now();
    
        // Duyệt qua tất cả các quả bom
        this.bombs.forEach(bomb => {
            const { row, col, power, created_date_local } = bomb;
    
            // Kiểm tra điều kiện thời gian
            if (currentTime - created_date_local >= 30) {
                // Đánh dấu vị trí quả bom
                this.map[row][col] = MAP_CELL.BOMB_ZONE;
    
                // Duyệt qua các hướng
                directions.forEach(({ dr, dc }) => {
                    for (let step = 1; step <= power; step++) {
                        const newRow = row + dr * step;
                        const newCol = col + dc * step;
    
                        // Kiểm tra nếu vị trí mới nằm ngoài bản đồ
                        if (
                            newRow < 0 ||
                            newRow >= this.map.length ||
                            newCol < 0 ||
                            newCol >= this.map[0].length
                        ) {
                            break;
                        }
    
                        // Nếu gặp vật cản, dừng nổ trong hướng này
                        if (blockCells.includes(this.map[newRow][newCol])) {
                            break;
                        }
    
                        // Đánh dấu vị trí bom nổ
                        this.map[newRow][newCol] = MAP_CELL.BOMB_ZONE;
                    }
                });
            }
        });
    }
    

    findEscapePath(start) {
        const directions = [
            { dr: 0, dc: -1, move: MOVE_DIRECTION.LEFT },  // Trái
            { dr: 0, dc: 1, move: MOVE_DIRECTION.RIGHT }, // Phải
            { dr: -1, dc: 0, move: MOVE_DIRECTION.UP },   // Lên
            { dr: 1, dc: 0, move: MOVE_DIRECTION.DOWN },  // Xuống
        ];

        const numRows = this.map.length;
        const numCols = this.map[0].length;
        const visited = Array.from({ length: numRows }, () =>
            Array(numCols).fill(false)
        );

        const queue = [{ row: start.row, col: start.col, path: "" }];
        visited[start.row][start.col] = true;

        while (queue.length > 0) {
            const { row, col, path } = queue.shift();

            // Nếu tìm thấy vị trí an toàn
            if (
                this.map[row][col] === MAP_CELL.ROAD ||
                this.map[row][col] === MAP_CELL.SPOILS
            ) {
                return path; // Trả về đường đi đến vị trí an toàn
            }

            // Duyệt các hướng
            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;

                // Kiểm tra nếu ô mới hợp lệ
                if (
                    newRow >= 0 &&
                    newRow < numRows &&
                    newCol >= 0 &&
                    newCol < numCols &&
                    !visited[newRow][newCol] &&
                    this.map[newRow][newCol] !== MAP_CELL.JAIL && // Không đi vào vùng bom
                    this.map[newRow][newCol] !== MAP_CELL.BORDER && // Không đi vào ranh giới
                    this.map[newRow][newCol] !== MAP_CELL.BALK && // Không đi vào chướng ngại vật
                    this.map[newRow][newCol] !== MAP_CELL.BRICK_WALL &&// Không đi vào tường gạch
                    this.map[newRow][newCol] !== MAP_CELL.ENEMY // Không đi vào tường gạch
                ) {
                    queue.push({
                        row: newRow,
                        col: newCol,
                        path: path + move,
                    });
                    visited[newRow][newCol] = true; // Đánh dấu đã thăm
                }
            }
        }

        // Không tìm thấy đường thoát
        return null;
    }

    // replace vị trí rìu thần thành dranger zone để né. Còn né được hay không thì .. 
    updateMapWithICBM(players, replacementValue) {
        players.forEach((player) => {
            const { destination } = player;
            const centerRow = destination.row;
            const centerCol = destination.col;
            const radius = 3;
    
            // Duyệt qua các hàng trong phạm vi bán kính
            for (let row = centerRow - radius; row <= centerRow + radius; row++) {
                if (row < 0 || row >= this.map.length) continue; // Bỏ qua nếu ngoài giới hạn map
    
                // Duyệt qua các cột trong phạm vi bán kính
                for (let col = centerCol - radius; col <= centerCol + radius; col++) {
                    if (col < 0 || col >= this.map[row].length) continue; // Bỏ qua nếu ngoài giới hạn map
    
                    // Tính khoảng cách Euclidean
                    const distance = Math.sqrt(Math.pow(centerRow - row, 2) + Math.pow(centerCol - col, 2));
                    if (distance <= radius && (this.map[row][col] === MAP_CELL.ROAD || this.map[row][col] == MAP_CELL.SPOILS)) {
                        // Thay thế giá trị nếu trong bán kính và giá trị bằng 0
                        this.map[row][col] = replacementValue;
                    }
                }
            }
        });
        return true;
    }

    // Ne thuy tinh
    isInDanger(bullets, playerPosition) {
        const dangerRange = 3
        const directions = {
            1: { dr: 0, dc: -1 }, // Trái
            2: { dr: 0, dc: 1 },  // Phải
            3: { dr: -1, dc: 0 }, // Lên
            4: { dr: 1, dc: 0 },  // Xuống
        };
    
        const { row: playerRow, col: playerCol } = playerPosition;
    
        // Kiểm tra từng viên đạn trong mảng
        for (const bullet of bullets) {
            const { currentRow, currentCol, direction } = bullet;
    
            // Kiểm tra trong phạm vi đạn di chuyển
            for (let step = 1; step <= dangerRange; step++) {
                const dangerRow = currentRow + directions[direction].dr * step;
                const dangerCol = currentCol + directions[direction].dc * step;
    
                // Kiểm tra nếu đạn ra ngoài bản đồ
                if (
                    dangerRow < 0 ||
                    dangerRow >= this.map.length ||
                    dangerCol < 0 ||
                    dangerCol >= this.map[0].length
                ) {
                    break; // Đạn vượt ngoài bản đồ
                }
    
                // Nếu đạn đến vị trí của bản thân, trả về true
                if (dangerRow === playerRow && dangerCol === playerCol) {
                    return true; // Đang trong vùng nguy hiểm
                }
    
                // Nếu gặp vật cản, đạn dừng
                if (this.map[dangerRow][dangerCol] !== MAP_CELL.ROAD) {
                    break;
                }
            }
        }
    
        return false; // Không trong vùng nguy hiểm
    }

    findSafePath(map, bullet) {
        const { currentRow, currentCol, direction } = bullet;
    
        // Vùng nguy hiểm: Đường đi của viên đạn
        const dangerPath = [];
        for (let step = 1; step <= map.length; step++) {
            const dangerRow = currentRow + directionsSW[direction].dr * step;
            const dangerCol = currentCol + directionsSW[direction].dc * step;
    
            if (
                dangerRow < 0 || dangerRow >= map.length ||
                dangerCol < 0 || dangerCol >= map[0].length
            ) {
                break; // Ra ngoài bản đồ
            }
    
            dangerPath.push({ row: dangerRow, col: dangerCol });
        }
    
        // Hướng ưu tiên tránh
        const priorityDirections = [
            directionsSW[(direction % 4) + 1], // Vuông góc phải
            directionsSW[(direction + 2) % 4 || 4], // Vuông góc trái
            { dr: -directionsSW[direction].dr, dc: -directionsSW[direction].dc }, // Ngược hướng
        ];
    
        // Tìm vị trí an toàn gần nhất
        for (const { dr, dc } of priorityDirections) {
            const newRow = currentRow + dr;
            const newCol = currentCol + dc;
    
            if (
                newRow >= 0 &&
                newRow < map.length &&
                newCol >= 0 &&
                newCol < map[0].length &&
                !dangerPath.some(d => d.row === newRow && d.col === newCol) &&
                (map[newRow][newCol] === MAP_CELL.ROAD || map[newRow][newCol] === MAP_CELL.SPOILS)
            ) {
                return { row: newRow, col: newCol }; // Vị trí an toàn
            }
        }
    
        return null; // Không tìm được vị trí an toàn
    }

    isWithinRadius(playerPosition, spoils, radius) {
        return spoils.filter(spoil => {
            const distance = Math.abs(playerPosition.row - spoil.row) + Math.abs(playerPosition.col - spoil.col);
            return distance <= radius;
        });
    }
    
    // Tìm đường đi bằng BFS
    findPathToSpoil(map, start, spoil) {
        const directions = [
            { dr: 0, dc: -1, move: "1" }, // Trái
            { dr: 0, dc: 1, move: "2" },  // Phải
            { dr: -1, dc: 0, move: "3" }, // Lên
            { dr: 1, dc: 0, move: "4" },  // Xuống
        ];
    
        const queue = [{ row: start.row, col: start.col, path: "" }];
        const visited = Array.from({ length: map.length }, () =>
            Array(map[0].length).fill(false)
        );
        visited[start.row][start.col] = true;
    
        while (queue.length > 0) {
            const { row, col, path } = queue.shift();
    
            // Nếu đến vị trí vật phẩm, trả về đường đi
            if (row === spoil.row && col === spoil.col) {
                return path;
            }
    
            // Duyệt các hướng
            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
    
                // Kiểm tra nếu vị trí mới hợp lệ
                if (
                    newRow >= 0 &&
                    newRow < map.length &&
                    newCol >= 0 &&
                    newCol < map[0].length &&
                    !visited[newRow][newCol] &&
                    (map[newRow][newCol] === MAP_CELL.ROAD || map[newRow][newCol] === MAP_CELL.SPOILS)
                ) {
                    queue.push({ row: newRow, col: newCol, path: path + move });
                    visited[newRow][newCol] = true; // Đánh dấu đã thăm
                }
            }
        }
    
        return null; // Không tìm được đường đi
    }
    
    // Main logic
    findSpoilAndPath(map, playerPosition, spoils) {
        // Kiểm tra vật phẩm trong bán kính 5
        const nearbySpoils = this.isWithinRadius(playerPosition, spoils, 30);
    
        if (nearbySpoils.length === 0) {
            return null;
        }
    
        // Tìm đường đến vật phẩm gần nhất
        for (const spoil of nearbySpoils) {
            const path = this.findPathToSpoil(map, playerPosition, spoil);
            if (path) {
                return { spoil, path };
            }
        }
    
        return null;
    }

    checkPathToEnemy(playerPosition, map) {
        const directions = [
            { dr: 0, dc: -1, move: MOVE_DIRECTION.LEFT },  // Trái
            { dr: 0, dc: 1, move: MOVE_DIRECTION.RIGHT }, // Phải
            { dr: -1, dc: 0, move: MOVE_DIRECTION.UP },   // Lên
            { dr: 1, dc: 0, move: MOVE_DIRECTION.DOWN },  // Xuống
        ];

        const radius = 10; // Bán kính tối đa
        const queue = [{ row: playerPosition.row, col: playerPosition.col, path: "" }];
        const visited = Array.from({ length: map.length }, () =>
            Array(map[0].length).fill(false)
        );
        visited[playerPosition.row][playerPosition.col] = true;

        while (queue.length > 0) {
            const { row, col, path } = queue.shift();

            // Nếu đến vị trí địch (MAP_CELL.ENEMY), trả về đường đi
            if (map[row][col] === MAP_CELL.ENEMY) {
                return path;
            }

            // Duyệt các hướng
            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
                const distance = Math.abs(playerPosition.row - newRow) + Math.abs(playerPosition.col - newCol);

                // Kiểm tra điều kiện hợp lệ của tọa độ mới
                if (
                    newRow >= 0 &&
                    newRow < map.length &&
                    newCol >= 0 &&
                    newCol < map[0].length &&
                    !visited[newRow][newCol] &&
                    distance <= radius && // Chỉ tính trong bán kính 10 ô
                    (map[newRow][newCol] === MAP_CELL.ROAD || map[newRow][newCol] === MAP_CELL.ENEMY)
                ) {
                    queue.push({ row: newRow, col: newCol, path: path + move });
                    visited[newRow][newCol] = true; // Đánh dấu đã thăm
                }
            }
        }

        return null; // Không tìm được đường đi
    }


    findPathWeaponDroped = (grid, start, destination) => {
        const directions = [
          [1, 0, '4'],  // Xuống
          [0, -1, '1'], // Trái
          [0, 1, '2'],  // Phải
          [-1, 0, '3'], // Lên
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
            (grid[x][y] === 0 || (x == destination.row && y == destination.col))
          );
        };
      
        const queue = [[start[0], start[1], []]]; // [row, col, path[]]
        const visited = Array.from({ length: grid.length }, () =>
          Array(grid[0].length).fill(false)
        );
        visited[start[0]][start[1]] = true;
      
        while (queue.length > 0) {
          const [x, y, path] = queue.shift();
      
          // Nếu gặp ô bua
          if (x == destination.row && y == destination.col) {
            const fullPath = [...path, { move: null, value: 6, row: x, col: y }];
            const stoppingPath = [];
            for (const step of fullPath) {
              if (step.move) stoppingPath.push(step.move);
            }
            return { type: EVENT_GAME.RUNNING, path: stoppingPath.join('') };
          }
      
          // Duyệt các hướng
          for (const [dx, dy, action] of directions) {
            const nx = x + dx;
            const ny = y + dy;
      
            if (isValid(nx, ny, visited)) {
              queue.push([
                nx,
                ny,
                [...path, { move: action, value: grid[x][y], row: x, col: y }],
              ]);
              visited[nx][ny] = true;
            }
          }
        }
      
        return { type: EVENT_GAME.NO_ACTION, path: null };
    };

    moveTwoStepsRandomly(map, playerPosition) {
        const directions = {
            [MOVE_DIRECTION.LEFT]: { dr: 0, dc: -1 },
            [MOVE_DIRECTION.RIGHT]: { dr: 0, dc: 1 },
            [MOVE_DIRECTION.UP]: { dr: -1, dc: 0 },
            [MOVE_DIRECTION.DOWN]: { dr: 1, dc: 0 }
        };
    
        const validDirections = [];
    
        // Kiểm tra các hướng hợp lệ
        for (const [direction, move] of Object.entries(directions)) {
            let currentRow = playerPosition.row;
            let currentCol = playerPosition.col;
    
            let isValid = true;
            for (let step = 1; step <= 2; step++) {
                const newRow = currentRow + move.dr;
                const newCol = currentCol + move.dc;
    
                // Kiểm tra nếu ô hợp lệ
                if (
                    newRow >= 0 &&
                    newRow < map.length &&
                    newCol >= 0 &&
                    newCol < map[0].length &&
                    (map[newRow][newCol] === MAP_CELL.ROAD || map[newRow][newCol] === MAP_CELL.SPOILS)
                ) {
                    currentRow = newRow;
                    currentCol = newCol;
                } else {
                    isValid = false;
                    break;
                }
            }
    
            if (isValid) {
                validDirections.push(direction);
            }
        }
    
        // Nếu không có hướng nào hợp lệ
        if (validDirections.length === 0) {
            console.log("No valid directions to move.");
            return { row: playerPosition.row, col: playerPosition.col, path: "" };
        }
    
        // Chọn một hướng ngẫu nhiên từ các hướng hợp lệ
        const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
        const move = directions[randomDirection];
    
        let currentRow = playerPosition.row;
        let currentCol = playerPosition.col;
        let path = "";
    
        // Di chuyển 2 bước theo hướng ngẫu nhiên
        for (let step = 1; step <= 2; step++) {
            const newRow = currentRow + move.dr;
            const newCol = currentCol + move.dc;
    
            if (
                newRow >= 0 &&
                newRow < map.length &&
                newCol >= 0 &&
                newCol < map[0].length &&
                (map[newRow][newCol] === MAP_CELL.ROAD || map[newRow][newCol] === MAP_CELL.SPOILS)
            ) {
                currentRow = newRow;
                currentCol = newCol;
                path += randomDirection;
            } else {
                break;
            }
        }
    
        return { row: currentRow, col: currentCol, path };
    }
    
}

export { GameMap };
