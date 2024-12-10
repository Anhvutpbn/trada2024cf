import { MAP_CELL, MOVE_DIRECTION, EVENT_GAME, SOCKET_EVENTS } from './config.js';
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
const directionsSW = {
    1: { dr: 0, dc: -1 }, // Trái
    2: { dr: 0, dc: 1 },  // Phải
    3: { dr: -1, dc: 0 }, // Lên
    4: { dr: 1, dc: 0 },  // Xuống
};
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
    }
    
    cloc(data) {
        console.log(data)
    }
    async checkingGameStatus(res) {
        // if(res.player_id === this.playerId) { console.log(res.tag) }
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
                if (enemy?.currentPosition) {
                    const { row, col } = enemy.currentPosition;
            
                    // Đặt vị trí hiện tại của enemy là MAP_CELL.ENEMY
                    this.map[row][col] = MAP_CELL.ENEMY;
            
                    // Cập nhật bán kính 2 ô xung quanh thành vùng bom
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const newRow = row + dr;
                            const newCol = col + dc;
            
                            // Kiểm tra nếu vị trí mới nằm trong bản đồ
                            if (
                                newRow >= 0 &&
                                newRow < this.map.length &&
                                newCol >= 0 &&
                                newCol < this.map[0].length
                            ) {
                                // Cập nhật vị trí xung quanh enemy thành MAP_CELL.BOMB_ZONE
                                if (this.map[newRow][newCol] !== MAP_CELL.ENEMY) {
                                    this.map[newRow][newCol] = MAP_CELL.BOMB_ZONE;
                                }
                            }
                        }
                    }
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
                    console.log("-tick 1")
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path , tick: 1};
                }
                if (findPathStoppingAtThree.type === EVENT_GAME.RUNNING || !this.isMoving) {
                    this.isMoving = true;
                    console.log("-tick 2")
                    return { type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path, tick: 2 };
                }
                if (findPathStoppingAtThree.type === EVENT_GAME.RUNNING || !this.isMoving) {
                    this.isMoving = true;
                    console.log("-tick 3")
                    return { type: EVENT_GAME.NO_ACTION, path: null, tick: 3 };
                }

                if (!this.hasValueThree(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col)) {
                    this.isMoving = false
                    console.log("CHAO EM CO GAI LAM HONG")
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                }
            }
            console.log(res.gameRemainTime)
            // if(!this.marry && this.player.playerInfo.eternalBadge > 0 ) {
            //     this.socket.emit('action', {							
            //         "action": "marry wife"						
            //     })	
            //     this.marry = true						
            // }
            // console.log(this.bombs)
            this.addBombs(res.map_info.bombs)
            this.removeExpiredBombs()
            this.replaceBombExplosionOnMap()
            if(res.map_info.weaponHammers.length > 0) {
                this.updateMapWithICBM(res.map_info.weaponHammers, MAP_CELL.BOMB_ZONE)
            }
            if (res.map_info.weaponWinds != undefined && res.map_info.weaponWinds && res.map_info.weaponWinds.length > 0) {
                const weaponWindsComming = this.isInDanger(res.map_info.weaponWinds,  this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col))
                if(weaponWindsComming) {
                    // console.log("--------------",this.findSafePath(this.map, res.map_info.weaponWinds))
                }
            }

            if(this.player.playerInfo.currentWeapon !== 2) {
                this.socket.emit('action', { action: "switch weapon" });
                // console.log("Doi Vu khi Chinh")
                return { type: EVENT_GAME.NO_ACTION, path: null, tick: "change weapon" };
            }

            // Neu dang trong vung bomb thi ne
            if(this.map[currentPlayer.currentPosition.row][currentPlayer.currentPosition.col] == MAP_CELL.BOMB_ZONE) {
                const runningPath = this.findEscapePath(this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col))
                if(runningPath) {
                    return { type: EVENT_GAME.RUNNING, path: runningPath, tick: "RUN BOMB AWAY" };
                } else {
                    return { type: EVENT_GAME.NO_ACTION, path: null };
                }
            }
            
            const spoildPath = this.findSpoilAndPath(this.map, this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col), res.map_info.spoils)

            if(spoildPath) {
                return { type: EVENT_GAME.RUNNING, path: spoildPath.path, tick: "RUN GET PATH" };
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

            // Đoạn này cần check nếu địch ở gần thì có thể đi đến đặt bomb và lùi lại. 

            // Sau khi không có địch thì ta có thể đi farm box. 
            const boxPath = this.findOptimalBombPosition(
                this.playerPosition(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col),
                this.player.playerInfo.power,
                this.map
            )
            return { type: EVENT_GAME.BOMBED, path: boxPath, tick: "BOMBED" };
            // if (!this.marry && this.player.playerInfo.eternalBadge > 0) {
            //     this.marry = true;
            //     return { type: EVENT_GAME.NO_ACTION, path: checkCanUseSpecialWeapon.target, tick: ":marry" };
            // }
            
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
            }, 10000);
        }

        
        if(result.type == EVENT_GAME.BOMBED) {
            const bombPositionSlice = result.path ? result.path.slice(0, -1) : "";
            this.emitDriver(SOCKET_EVENTS.DRIVE_PLAYER, bombPositionSlice+"b")
        }
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


    // Tính toán tìm kiếm địch ở trong range Nếu có thì bắn đạn

    isWithinRange = (playerPosition, enemyPosition) => {
        const { col: playerCol, row: playerRow } = playerPosition;
        const { col: enemyCol, row: enemyRow } = enemyPosition;
      
        // Tính khoảng cách Euclidean
        const distance = Math.sqrt(
          Math.pow(playerCol - enemyCol, 2) + Math.pow(playerRow - enemyRow, 2)
        );
      
        // Kiểm tra nếu khoảng cách nằm trong khoảng [3, 5]
        return distance >= 3 && distance <= 4;
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
            if (this.map[row][col] == MAP_CELL.BALK) {
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
        newBombs.forEach(newBomb => {
            // Tạo giá trị `createdAt` đã được cộng thêm 500
            const adjustedCreatedAt = newBomb.createdAt + 500;
    
            // Kiểm tra nếu `createdAt` đã tồn tại trong mảng
            const exists = this.bombs.some(bomb => bomb.createdAt === adjustedCreatedAt);
    
            if (!exists) {
                // Tạo bản sao của quả bom mới, cập nhật `remainTime` và `createdAt`
                const updatedBomb = {
                    ...newBomb,
                    remainTime: newBomb.remainTime + 100,
                    createdAt: adjustedCreatedAt, // Sử dụng giá trị đã điều chỉnh
                };
    
                // Thêm quả bom vào mảng
                this.bombs.push(updatedBomb);
            }
        });
    }
    
    // Hàm xóa các quả bom đã hết hạn
    removeExpiredBombs() {
        const currentTimestamp = Date.now();
        this.bombs = this.bombs.filter(bomb => currentTimestamp - bomb.createdAt <= 2000);
    }

    replaceBombExplosionOnMap() {
        const directions = [
            { dr: 0, dc: -1 }, // Trái
            { dr: 0, dc: 1 },  // Phải
            { dr: -1, dc: 0 }, // Lên
            { dr: 1, dc: 0 },  // Xuống
        ];
    
        const blockCells = [MAP_CELL.BORDER, MAP_CELL.BRICK_WALL, MAP_CELL.JAIL, MAP_CELL.BALK];
    
        // Lấy thời gian hiện tại
        const currentTime = Date.now();
    
        // Duyệt qua tất cả các quả bom
        this.bombs.forEach(bomb => {
            const { row, col, power, createdAt } = bomb;
    
            // Kiểm tra điều kiện thời gian
            if (currentTime - createdAt >= 35) {
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
                    this.map[newRow][newCol] !== MAP_CELL.BRICK_WALL // Không đi vào tường gạch
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
        const nearbySpoils = this.isWithinRadius(playerPosition, spoils, 5);
    
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

}

export { GameMap };
