// Constants for Map Cells
const MapCell = {
    Road: 0,           // Ô trống (Người chơi có thể đi qua)
    Border: 1,         // Ranh giới Map (Không thể phá hủy)
    Balk: 2,           // Chướng ngại vật (Phá hủy được)
    BrickWall: 3,      // Tường gạch (Dùng Chày gỗ để phá, thường là vật cản tới 'Huy Hiệu Thần')
    Jail: 5,           // Nhà tù
    GodBadge: 6,       // Huy Hiệu Thần (Đứng ở đây 3s để trở thành Bất Tử)
    SpecialZone: 7,   // Vùng đất bị phá hủy bởi vũ khí đặc biệt (Có thể di chuyển qua)
    BombZone: 77,
    Spoils: 99 // Cac gia tri duoc replace boi vi tri cua spoil
};


const MoveDirection = {
    LEFT: "1",  // Di chuyển sang trái
    RIGHT: "2", // Di chuyển sang phải
    UP: "3",    // Di chuyển lên trên
    DOWN: "4",  // Di chuyển xuống dưới
};

const START_GAME = "start-game"
const UPDATE_GAME = "update-data"
const MOVING_BANNED = "player:moving-banned"
const START_MOVING = "player:start-moving"
const STOP_MOVING = "player:stop-moving"
const BE_ISOLATED = "player:be-isolated"
const BTPG = "player:back-to-playground"
const BOMB_EXPLODED = "bomb:exploded"
const STUN = "player:stun-by-weapon"
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
        this.position = gameMap.to1dPos(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
        this.playerInfo = playerInfo;
    }
}

class GameMap {
    constructor(socket, playerId) {
        this.socket = socket;
        this.playerId = playerId;
        this.map = [];
        this.flatMap = [];
        this.mapWidth = 26;
        this.mapHeight = 14;
        this.player = null;
        this.bombs = []
        this.spoils = []
        this.bombsPosition = []
        // Trạng thái di chuyển và phá tường
        this.emitStatus = false;
        this.isMoving = false;
        this.isBreaking = false;
        this.currentTarget = null;
        this.isWaitingAtGodBadge = false; 

         // Trạng thái đứng yên
         this.lastMoveTime = Date.now(); // Lần cuối cùng di chuyển
         this.lastPosition = null; // Vị trí lần cuối
         this.awayFromBom = false;
    }
    reset() {
        // Đặt lại tất cả các biến về giá trị mặc định
        this.map = [];
        this.flatMap = [];
        this.mapWidth = 26;
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
        this.lastMoveTime = Date.now(); // Cập nhật thời gian di chuyển cuối
        this.lastPosition = null;
        this.awayFromBom = false;
    }
    async parseTicktack(res) {
        if(
            this.playerId.includes(res.player_id) && 
            ( 
                res.tag == BOMB_EXPLODED || 
                res.tag == MOVING_BANNED ||
                res.tag == BTPG ||
                res.tag == STUN
            )
        ) {
            console.log("-------------------------GAME RESTART---------------------------------");
            this.reset()
        }

        if(
            this.playerId.includes(res.player_id) && 
            ( 
                res.tag == STOP_MOVING|| 
                res.tag == MOVING_BANNED
            )
        ) {
            console.log("-------------------------GAME UDPATE---------------------------------");
            this.awayFromBom = false
        }

        this.map = res.map_info.map;

        const enemy = res.map_info.players.find(p => !this.playerId.includes(p.id));
        if(enemy) {
            if(enemy.currentPosition.col !== undefined) {
                this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MapCell.Balk
            }
        }
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        this.spoils = res.map_info.spoils;
        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        this.player = new GamePlayer(this, currentPlayer);

        console.log("this.player.playerInfo.transformType", this.player.playerInfo.transformType, this.player.playerInfo.timeToUseSpecialWeapons)
        this.bombsPosition = []
        const hasTransform = this.player.playerInfo.hasTransform;
        this.bombs = res.map_info.bombs.filter(bomb => bomb.playerId === this.player.playerInfo.id);
        // console.log("----------------------------------------------------------")
        // console.log("----" + this.bombs.length, this.hasPlacedBomb, hasTransform)
        // console.log("this.position:  " + this.player.position)
        // console.log("this.bombs:  " , res.map_info.bombs, this.player.playerInfo.power)
        // console.log("this.spoils:  " , this.spoils)
        // console.log("----------------------------------------------------------")

        // if(this.player.playerInfo.transformType != undefined  && this.player.playerInfo.timeToUseSpecialWeapons) {
        //     if(enemy.currentPosition.col !== undefined && enemy.hasTransform) {
        //         this.socket.emit("action", {
        //             action: "use weapon",
        //             payload: {
        //                 destination: {
        //                     col: enemy.currentPosition.col,
        //                     row: enemy.currentPosition.row
        //                 }
        //             }
        //         });
        //     }
        // }
        this.replaceSpoilsToMapValue()
        // Kiểm tra trạng thái đứng yên
        this.checkIdleStatus();
    
        // Lặp qua tất cả các bomb trên bản đồ và tính toán vùng ảnh hưởng
        await res.map_info.bombs.forEach(bomb => {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            this.bombsPosition.push(bombPosition)
            this.replaceBombImpactWithSpecialZone(bombPosition)
        });
        
        if(this.playerStopNearbyBomb()) {
            console.log("-------------------------TRUNG SINH-------------------------")
            this.emitDriver('drive player', { direction: 'x' });
            return;
        }
        
        if(this.flatMap[this.player.position] == MapCell.BombZone && !this.awayFromBom ) {
            console.log("-------------------------Start---------------------------------");
            this.awayFromBom = true
            await this.escapeFromDangerZone()
            console.log("-------------------------End---------------------------------");
            return
        }
        if (this.bombs.length == 0) {
            // const spoilsPath = this.findNearestSpoils(this.player.position, 5); // Tìm Spoils trong bán kính 5 ô
            //     if (spoilsPath) {
            //         console.log(`Found spoils at path: ${spoilsPath.path}`);
            //         this.socket.emit('drive player', { direction: spoilsPath.path });
            //     } else {
            //         console.log("No spoils found nearby.");
            //     }
            // this.hasPlacedBomb = false;
        } else {
            // this.hasPlacedBomb = true;
            // if(this.flatMap[this.player.position] == MapCell.BombZone && !this.awayFromBom) {
            //     this.escapeFromDangerZone()
            // } else {
            //     // Nhat Spoils
                
            // }
            return;
        }
    
        // Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường
        // console.log("Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường", this.hasPlacedBomb)     
        this.decideNextAction(hasTransform);
    }
    
    replaceBombImpactWithSpecialZone(bombPosition) {
        const bombImpactArea = this.getBombImpactArea(bombPosition);
        bombImpactArea.forEach(position => {
            if (this.flatMap[position] !== MapCell.Border) {
                this.flatMap[position] = MapCell.BombZone; // Thay thế bằng số 77
            }
        });
    }


    replaceSpoilsToMapValue() {
        // Duyệt qua tất cả các item trong this.spoils
        this.spoils.forEach(spoil => {
            const { row, col } = spoil;
            // Tính chỉ số phẳng (1D) từ tọa độ 2D
            const index = this.to1dPos(row, col);
            // Kiểm tra chỉ số hợp lệ trước khi thay thế
            if (index >= 0 && index < this.flatMap.length) {
            this.flatMap[index] = MapCell.Spoils; // Gán giá trị 99
            }
        });
    }   

    findNearestSpoils(startPosition, radius) {
        const directions = [
            { dx: 1, dy: 0 }, // Right
            { dx: -1, dy: 0 }, // Left
            { dx: 0, dy: 1 }, // Down
            { dx: 0, dy: -1 }, // Up
        ];
    
        const { x: startX, y: startY } = this.to2dPos(startPosition);
    
        for (const { dx, dy } of directions) {
            for (let step = 1; step <= radius; step++) {
                const newX = startX + dx * step;
                const newY = startY + dy * step;
    
                if (newX < 0 || newY < 0 || newX >= this.mapWidth || newY >= this.mapHeight) break;
    
                const newIndex = this.to1dPos(newX, newY);
                if (this.flatMap[newIndex] === MapCell.Spoils) {
                    const path = this.findPath(startPosition, newIndex); // Tìm đường đi
                    if (path) {
                        return { index: newIndex, path }; // Trả về đường đi và vị trí
                    }
                    break;
                }
            }
        }
    
        return null; // Không tìm thấy Spoils
    }

    isPlayerInDangerZone() {
        const playerPosition = this.player.position;
        // Duyệt qua tất cả bomb để kiểm tra vùng ảnh hưởng
        return this.bombs.some(bomb => {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            const bombImpactArea = this.getBombImpactArea(bombPosition);
            this.replaceBombImpactWithSpecialZone(bombPosition);
            return bombImpactArea.has(playerPosition);
        });


    }
    
    async escapeFromDangerZone() {
        // Tìm vị trí an toàn gần nhất
        const playerPosition = this.to2dPos(this.player.position)
        const map = this.convertFlatTo2Dmap()
        let safePosition = this.runbomb( playerPosition.y, playerPosition.x, map);
        if (safePosition !== null) {
            this.forceMoveTo(safePosition); // Di chuyển ngay lập tức
            return;
        } else {
            console.warn("No safe position found. Attempting manual escape.");
        }
    }
    
    convertFlatTo2Dmap() {
        const map = [];
        for (let i = 0; i < this.flatMap.length; i += this.mapWidth) {
            map.push(this.flatMap.slice(i, i + this.mapWidth));
        }

        return map
    }

    checkIdleStatus() {
        const currentPosition = this.player.position;

        if (this.lastPosition === currentPosition) {
            const timeSinceLastMove = Date.now() - this.lastMoveTime;

            if (timeSinceLastMove > 4000) { // Nếu đứng yên quá 7 giây
                this.awayFromBom = false;
                this.hasPlacedBomb = false;
                this.forceRandomMove();
                this.lastMoveTime = Date.now(); // Cập nhật thời gian di chuyển cuối
            }
        } else {
            this.lastPosition = currentPosition;
            this.lastMoveTime = Date.now(); // Cập nhật thời gian di chuyển cuối
        }
    }

    forceRandomMove() {
        const neighbors = this.getNeighborNodes(this.player.position);
    
        // Chọn ngẫu nhiên một ô lân cận có thể di chuyển
        const validNeighbors = neighbors.filter(({ pos }) => 
            this.flatMap[pos] === MapCell.Road || this.flatMap[pos] === MapCell.Spoils // Thêm MapCell.Spoils
        );
    
        if (validNeighbors.length > 0) {
            const randomNeighbor = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
            console.log(`Forced move to direction: ${randomNeighbor.dir}`);
            this.emitDriver('drive player', { direction: randomNeighbor.dir });
        }
    }
    


    to1dPos(x, y) {
        return y * this.mapWidth + x;
    }

    to2dPos(pos) {
        const x = pos % this.mapWidth;
        const y = Math.floor(pos / this.mapWidth);
        return { x, y };
    }
    
    shouldBreak(position) {
        const neighbors = this.getNeighborNodes(position);
        for (let neighbor of neighbors) {
            const cellValue = this.flatMap[neighbor.pos];
            if (cellValue === MapCell.BrickWall || cellValue === MapCell.Player) {
                return true; // Có tường gạch hoặc player xung quanh
            }
        }
        return false;
    }

    updateMapAfterBreaking(targetPos) {
        this.flatMap[targetPos] = MapCell.Road; // Biến tường gạch thành đường trống
    }

    decideNextAction(hasTransform) {
        if (this.isMoving || this.isBreaking || this.isWaitingAtGodBadge) {
            return; // Không thực hiện thêm hành động khi đang bận
        }
    
        const playerPosition = this.player.position;
        if (hasTransform === undefined) {
            console.warn("Transform state is undefined. Skipping action.");
            return;
        }
        // console.warn("Nếu đã transformed, chỉ đặt bomb và tránh vùng nổ");
        // Nếu đã transformed, chỉ đặt bomb và tránh vùng nổ
        if (hasTransform) {
            // console.log("Player is transformed. Switching to bomb logic.");
    
            if (this.player.playerInfo.currentWeapon !== 2) {
                this.socket.emit('action', { action: "switch weapon" });
                this.player.playerInfo.currentWeapon = 2; // Cập nhật trạng thái weapon
                return;
            }
    
            if (!this.hasPlacedBomb) {
                const bombPosition = this.findOptimalBombPosition(playerPosition);

                if (bombPosition) {
                    this.placeBombAndRetreat(bombPosition);
                    return;
                } else {
                    // console.log("No optimal bomb position found. Waiting for next action.");
                    return;
                }
            } else {
                // console.log("Bomb is already placed. Waiting for next action.");
                return;
            }
        }
        console.log("Ưu tiên đến GodBadge nếu chưa transformed");
        // Ưu tiên đến GodBadge nếu chưa transformed
        const closestGodBadge = this.findClosestCell(playerPosition, MapCell.GodBadge);
        if (closestGodBadge !== null && this.currentTarget !== closestGodBadge) {
            const pathToBadge = this.findPath(playerPosition, closestGodBadge);
    
            if (pathToBadge && this.isPathValid(pathToBadge, playerPosition)) {
                console.log(`Moving to GodBadge at position: ${closestGodBadge}`);
                this.currentTarget = closestGodBadge;
                this.moveToAndWait(pathToBadge, 3000); // Đứng tại GodBadge trong 3 giây
                return;
            }
        }
        // Nếu không có GodBadge hoặc đã biến hình, tìm tường gạch gần nhất
        const closestBrickWall = this.findClosestCell(playerPosition, MapCell.BrickWall);
        if (closestBrickWall !== null && this.currentTarget !== closestBrickWall) {
            const pathToBrick = this.findPath(playerPosition, closestBrickWall);
    
            if (pathToBrick && pathToBrick.length > 0) {
                console.log(`Moving to destroy BrickWall at position: ${closestBrickWall}`);
                this.currentTarget = closestBrickWall;
                this.moveToAndBreakProperly(pathToBrick, closestBrickWall);
                return;
            }
        }
    
        this.currentTarget = null;
    }
    
    
    moveToAndWait(path, waitTime) {
        if (path && path.length > 0) {
            this.isMoving = true;
            this.moveTo(path);
    
            setTimeout(() => {
                this.isMoving = false;
                this.isWaitingAtGodBadge = true;
    
                // Chờ 3 giây tại GodBadge
                setTimeout(() => {
                    this.isWaitingAtGodBadge = false;
                    this.decideNextAction(); // Tiếp tục hành động tiếp theo
                }, waitTime);
            }, path.length * 500); // Thời gian di chuyển phụ thuộc vào độ dài path
        } else {
            this.isMoving = false;
        }
    }
    
    

    moveToAndBreakProperly(path, targetPos) {
        if (path.length > 0) {
            this.isMoving = true;
            this.moveTo(path); // Di chuyển đến gần tường gạch
    
            // Sau khi di chuyển xong
            setTimeout(() => {
                this.isMoving = false;
    
                const playerPosition = this.player.position;
                const directionToBrick = this.getDirectionToNeighbor(playerPosition, targetPos);
    
                if (directionToBrick) {
                    this.emitDriver('drive player', { direction: directionToBrick }); // Quay mặt vào tường
    
                    setTimeout(() => {
                        this.emitDriver('drive player', { direction: "b" }); // Phá tường
    
                        // Cập nhật bản đồ sau khi phá tường
                        this.updateMapAfterBreaking(targetPos);
    
                        // Kiểm tra và phá tiếp các tường xung quanh nếu có
                        setTimeout(() => {
                            this.isBreaking = false;
                            this.breakSurroundingBrickWalls(); // Kiểm tra và phá tiếp các tường xung quanh
                        }, 100);
                    }, 200); // Đợi sau khi quay mặt để phá tường
                }
            }, path.length * 30); // Thời gian chờ phụ thuộc vào độ dài đường đi
        }
    }
    
    breakSurroundingBrickWalls() {
        const playerPosition = this.player.position;
    
        // Lấy danh sách các ô lân cận
        const neighbors = this.getNeighborNodes(playerPosition);
    
        for (let neighbor of neighbors) {
            const { pos, dir } = neighbor;
            const cellValue = this.flatMap[pos];
    
            // Kiểm tra nếu ô lân cận là tường gạch
            if (cellValue === MapCell.BrickWall) {
                
                // Quay mặt vào tường gạch
                this.emitDriver('drive player', { direction: dir });
    
                setTimeout(() => {
                    this.emitDriver('drive player', { direction: "b" }); // Phá tường
    
                    // Cập nhật bản đồ sau khi phá tường
                    this.updateMapAfterBreaking(pos);
    
                    // Tiếp tục kiểm tra và phá các tường khác
                    setTimeout(() => {
                        this.breakSurroundingBrickWalls();
                    }, 500);
                }, 500);
    
                return; // Dừng vòng lặp để xử lý từng tường một
            }
        }
    
        this.decideNextAction(); // Tiếp tục hành động tiếp theo
    }

    

    getDirectionToNeighbor(currentPos, targetPos) {
        const { x: currX, y: currY } = this.to2dPos(currentPos);
        const { x: targetX, y: targetY } = this.to2dPos(targetPos);
    
        if (currX === targetX && currY - 1 === targetY) return MoveDirection.UP;    // Target ở trên
        if (currX === targetX && currY + 1 === targetY) return MoveDirection.DOWN;  // Target ở dưới
        if (currX - 1 === targetX && currY === targetY) return MoveDirection.LEFT;  // Target ở trái
        if (currX + 1 === targetX && currY === targetY) return MoveDirection.RIGHT; // Target ở phải
    
        return null; // Không phải ô lân cận
    }
    

    emitDriver(event, data) {
        if (!this.emitStatus) {
            this.emitStatus = true;
            this.socket.emit(event, data);

            setTimeout(() => {
                this.emitStatus = false;
            }, data.length * 100);
        } else {
            console.log("Emit blocked due to cooldown.");
        }
    }

    findClosestCell(playerPosition, cellType) {
        let closestCell = null;
        let minDistance = Infinity;

        this.flatMap.forEach((cell, index) => {
            if (cell === cellType) {
                const path = this.findPath(playerPosition, index);
                if (path && path.length > 0) {
                    const distance = path.length;
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCell = index;
                    }
                }
            }
        });

        return closestCell;
    }

    findPath(startPos, targetPos) {
        const startNode = new TreeNode(startPos);
        const resultNode = this.scanRawMap(startNode, this.flatMap, (currentNode) => {
            if (currentNode.val === targetPos) {
                return [currentNode, false];
            }
            return [null, false];
        });

        if (resultNode) {
            const path = [];
            let node = resultNode;
            while (node.parent) {
                path.unshift(node.dir);
                node = node.parent;
            }
            return path;
        }

        return null;
    }

    isPathValid(path, startPos) {
        let currentPos = startPos; // Bắt đầu từ vị trí hiện tại
        for (const step of path) {
            // Tính vị trí tiếp theo dựa trên bước đi
            const { x, y } = this.to2dPos(currentPos);
            if (step === MoveDirection.UP) currentPos = this.to1dPos(x, y - 1);
            if (step === MoveDirection.DOWN) currentPos = this.to1dPos(x, y + 1);
            if (step === MoveDirection.LEFT) currentPos = this.to1dPos(x - 1, y);
            if (step === MoveDirection.RIGHT) currentPos = this.to1dPos(x + 1, y);
    
            // Kiểm tra nếu ô không hợp lệ
            const cellValue = this.flatMap[currentPos];
            if (cellValue !== MapCell.Spoils && cellValue !== MapCell.Road && cellValue !== MapCell.GodBadge) {
                console.log(`Invalid cell found at position ${currentPos}: ${cellValue}`);
                return false;
            }
        }
        return true; // Tất cả các ô hợp lệ
    }
    

    getNeighborNodes(val) {
        const cols = this.mapWidth;

        return [
            { pos: val - cols, dir: MoveDirection.UP },
            { pos: val + cols, dir: MoveDirection.DOWN },
            { pos: val - 1, dir: MoveDirection.LEFT },
            { pos: val + 1, dir: MoveDirection.RIGHT },
        ].filter(neighbor => {
            const { pos } = neighbor;
            return pos >= 0 && pos < this.flatMap.length;
        });
    }

    scanRawMap(startNode, map, callback) {
        const queue = [startNode];
        const visited = new Set([startNode.val]);

        while (queue.length) {
            const currentNode = queue.shift();

            if (callback) {
                const [result, ignoreThisNode] = callback(currentNode);
                if (ignoreThisNode) continue;
                if (result) return result;
            }

            const neighbors = this.getNeighborNodes(currentNode.val);
            for (let neighbor of neighbors) {
                const { pos, dir } = neighbor;
                const cellValue = map[pos];

                if (
                    cellValue === MapCell.Spoils ||
                    cellValue === MapCell.Road ||
                    cellValue === MapCell.BrickWall ||
                    cellValue === MapCell.GodBadge
                ) {
                    if (!visited.has(pos)) {
                        visited.add(pos);
                        const neighborNode = new TreeNode(pos, dir, currentNode);
                        currentNode.children.push(neighborNode);
                        queue.push(neighborNode);
                    }
                }
            }
        }

        return null;
    }


    // Supper Player solution

    // Hàm tìm vị trí đặt bomb
    findOptimalBombPosition(position) {
        // this.printMap2D()
        if (!this.mapWidth || typeof this.mapWidth !== "number" || this.mapWidth <= 0) {
            console.error("Error: Invalid or undefined mapWidth");
            return null;
        }
    
        const numRows = Math.floor(this.flatMap.length / this.mapWidth);
    
        if (position < 0 || position >= this.flatMap.length) {
            console.error("Error: Invalid position index");
            return null;
        }
    
        // Chuyển vị trí từ chỉ số phẳng (flat index) thành tọa độ 2D
        const startRow = Math.floor(position / this.mapWidth);
        const startCol = position % this.mapWidth;
    
        // Tọa độ di chuyển tương ứng với MoveDirection
        const directions = [
            { dr: 0, dc: -1, move: MoveDirection.LEFT },  // Trái
            { dr: 0, dc: 1, move: MoveDirection.RIGHT }, // Phải
            { dr: -1, dc: 0, move: MoveDirection.UP },   // Lên
            { dr: 1, dc: 0, move: MoveDirection.DOWN },  // Xuống
        ];
    
        // BFS: Hàng đợi chứa các trạng thái {row, col, path}
        const queue = [];
        const visited = new Set();
    
        // Thêm trạng thái bắt đầu vào hàng đợi
        queue.push({ row: startRow, col: startCol, path: "" });
        visited.add(position); // Đánh dấu đã duyệt vị trí bắt đầu
    
        while (queue.length > 0) {
            const current = queue.shift();
            const { row, col, path } = current;
    
            // Chuyển tọa độ 2D (row, col) thành index phẳng
            const flatIndex = row * this.mapWidth + col;

            // Nếu tìm thấy Balk (ô giá trị 2), trả về đường đi
            if (this.flatMap[flatIndex] === MapCell.Balk) {
                console.log(`Found Balk at row=${row}, col=${col}`);
                return path;
            }
    
            // Thử tất cả hướng di chuyển
            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
    
                // Kiểm tra điều kiện hợp lệ của tọa độ mới
                if (
                    newRow >= 0 &&
                    newRow < numRows &&
                    newCol >= 0 &&
                    newCol < this.mapWidth
                ) {
                    const newFlatIndex = newRow * this.mapWidth + newCol;
    
                    if (
                        !visited.has(newFlatIndex) && // Chưa duyệt qua
                        (this.flatMap[newFlatIndex] === MapCell.Road || this.flatMap[newFlatIndex] === MapCell.Balk) && // Chỉ đi qua Road hoặc Balk
                        this.flatMap[newFlatIndex] !== MapCell.BombZone // Tuyệt đối không đi qua BombZone
                    ) {
                        queue.push({ row: newRow, col: newCol, path: path + move });
                        visited.add(newFlatIndex); // Đánh dấu vị trí đã duyệt
                    }
                }
            }
        }
    
        // Nếu không tìm thấy đường đi
        console.log("No valid path found.");
        return null;
    }
    
    
    getFlatPosition(row, col) {
        // Kiểm tra giới hạn
        if (row < 0 || row >= this.rows || col < 0 || col >= this.columns) {
            return null; // Tọa độ không hợp lệ
        }
        return row * this.columns + col;
    }

    isSafeToPlaceBomb(bombPosition) {
        return true; // Không có đường thoát an toàn
    }
    

    // Hàm tính số lượng hộp bị phá hủy bởi bomb
    calculateBombImpact(position) {
        let impactCount = 0;
    
        const directions = [MoveDirection.UP, MoveDirection.DOWN, MoveDirection.LEFT, MoveDirection.RIGHT];
        directions.forEach(dir => {
            let currentPos = position;
            for (let i = 0; i < this.player.playerInfo.power; i++) {
                const { x, y } = this.to2dPos(currentPos);
                if (dir === MoveDirection.UP) currentPos = this.to1dPos(x, y - 1);
                if (dir === MoveDirection.DOWN) currentPos = this.to1dPos(x, y + 1);
                if (dir === MoveDirection.LEFT) currentPos = this.to1dPos(x - 1, y);
                if (dir === MoveDirection.RIGHT) currentPos = this.to1dPos(x + 1, y);
    
                // Dừng nếu vượt ngoài bản đồ
                if (currentPos < 0 || currentPos >= this.flatMap.length) break;
    
                const cellValue = this.flatMap[currentPos];
                if (cellValue === MapCell.Balk) {
                    impactCount++;
                }
                if (cellValue !== MapCell.Road && cellValue !== MapCell.Balk && cellValue !== MapCell.Spoils) {
                    break; // Gặp vật cản thì dừng
                }
            }
        });
    
        return impactCount;
    }
    

    // Hàm đặt bomb và di chuyển đến vị trí an toàn
    placeBombAndRetreat(bombPosition) {
        const playerPosition = this.player.position;
        const neighbors = this.getNeighborNodes(playerPosition);
        const hasBalk = neighbors.some(({ pos }) => this.flatMap[pos] === MapCell.Balk);
        if(bombPosition) {
            // this.socket.emit('drive player', { direction: bombPosition+"b" });
            this.emitDriver('drive player', { direction: bombPosition });
             // Ước lượng thời gian di chuyển
        }
        if(hasBalk) {
            setTimeout(() => {
                this.emitDriver('drive player', { direction: "b" });
            }, 100);
        }
    }
    
    forceMoveTo(path) {
        if (Array.isArray(path)) {
            // Nếu path là một mảng, chuyển thành chuỗi
            path = path.join(""); 
        }
    
        if (path && path.length > 0) {
            this.socket.emit('drive player', { direction: path });
            setTimeout(() => {
                this.awayFromBom = false;
                console.warn("No valid path for force move.", path);
            }, 200);
        } else {
            console.warn("No valid path for force move.");
        }
    }
    
    
    
    forceMoveManuallyAwayFromBomb(bombPosition) {
        const directions = [
            { dx: 1, dy: 0 }, // Right
            { dx: -1, dy: 0 }, // Left
            { dx: 0, dy: 1 }, // Down
            { dx: 0, dy: -1 } // Up
        ];
    
        const { x: playerX, y: playerY } = this.to2dPos(this.player.position);
    
        for (const { dx, dy } of directions) {
            const newX = playerX + dx;
            const newY = playerY + dy;
            const newPos = this.to1dPos(newX, newY);
    
            if (this.isValidPosition(newPos)) {
                console.log(`Forcing manual move to position: ${newPos}`);
                this.socket.emit('drive player', { direction: String(newPos) });
                return;
            }
        }
    
        console.warn("No valid manual escape moves available.");
    }
    
    
    // Hàm xác định vùng ảnh hưởng của bomb
    getBombImpactArea(bombPosition) {
        const impactArea = new Set();
        impactArea.add(bombPosition); // Thêm tâm bom vào vùng ảnh hưởng
        const directions = [MoveDirection.UP, MoveDirection.DOWN, MoveDirection.LEFT, MoveDirection.RIGHT];
        // Duyệt qua từng hướng (Lên, Xuống, Trái, Phải)
        directions.forEach(dir => {
            let currentPos = bombPosition;
            // Tính toán vùng ảnh hưởng trong phạm vi sức mạnh của người chơi
            for (let i = 1; i <= this.player.playerInfo.power; i++) {
                const { x, y } = this.to2dPos(currentPos);
                // Di chuyển theo hướng tương ứng
                let newX = x, newY = y;
                if (dir === MoveDirection.UP) newY -= 1;
                if (dir === MoveDirection.DOWN) newY += 1;
                if (dir === MoveDirection.LEFT) newX -= 1;
                if (dir === MoveDirection.RIGHT) newX += 1;
                // Chuyển từ tọa độ 2D sang tọa độ 1D
                const newIndex = this.to1dPos(newX, newY);
                // Kiểm tra nếu vị trí nằm ngoài bản đồ
                if (newIndex < 0 || newIndex >= this.flatMap.length) break;
                const cellValue = this.flatMap[newIndex];
                // Nếu gặp khối không thể xuyên qua, dừng lại và không thêm khối đó vào vùng nổ
                if ( cellValue != MapCell.Road && cellValue != MapCell.Spoils) {
                    break;
                }
                // Nếu ô hợp lệ, thêm vào vùng nổ
                impactArea.add(newIndex);
    
                // Di chuyển vị trí hiện tại
                currentPos = newIndex;
            }
        });
    
        return impactArea;
    }
    
    
    
    getManhattanDistance(pos1, pos2) {
        const pos1_2d = this.to2dPos(pos1);
        const pos2_2d = this.to2dPos(pos2);

        return Math.abs(pos1_2d.x - pos2_2d.x) + Math.abs(pos1_2d.y - pos2_2d.y);
    }
    
    findPathToAdjacentBalk(playerPosition) {
        const maxSteps = 9; // Số bước tối đa
        const directions = [
            { dx: -1, dy: 0, code: "1" }, // Lên
            { dx: 1, dy: 0, code: "2" },  // Xuống
            { dx: 0, dy: -1, code: "3" }, // Trái
            { dx: 0, dy: 1, code: "4" }   // Phải
        ];
    
        const { x: fromX, y: fromY } = this.getPositionCoordinates(playerPosition);
    
        for (const direction of directions) {
            let path = ""; // Chuỗi lưu lại các bước đi
            for (let step = 1; step <= maxSteps; step++) {
                const newX = fromX + step * direction.dx;
                const newY = fromY + step * direction.dy;
                const newIndex = this.getIndexFromCoordinates(newX, newY);
    
                // Chỉ chấp nhận ô có giá trị 0
                if (!this.isValidIndex(newIndex) || this.flatMap[newIndex] !== 0) break;
    
                path += direction.code; // Ghi lại hướng đi
    
                // Kiểm tra các ô xung quanh ô hiện tại xem có ô Balk (giá trị 2) không
                const neighbors = [
                    { x: newX - 1, y: newY }, // Lên
                    { x: newX + 1, y: newY }, // Xuống
                    { x: newX, y: newY - 1 }, // Trái
                    { x: newX, y: newY + 1 }  // Phải
                ];
    
                for (const neighbor of neighbors) {
                    const neighborIndex = this.getIndexFromCoordinates(neighbor.x, neighbor.y);
                    if (this.isValidIndex(neighborIndex) && this.flatMap[neighborIndex] === 2) {
                        // Tìm thấy Balk (giá trị 2) gần ô hiện tại
                        console.log(`Found path to adjacent Balk: ${path}`);
                        return path; // Trả về đường đi
                    }
                }
            }
        }
    
        console.warn("No valid path to adjacent Balk found.");
        return ""; // Không tìm thấy đường đi hợp lệ
    }
    
    
    
    // Hàm kiểm tra vị trí có an toàn không
    checkSafeMove(index) {
        return (
            index >= 0 &&
            index < this.flatMap.length &&
            (
                this.flatMap[index] === MapCell.Road || 
                this.flatMap[index] === MapCell.BombZone || 
                this.flatMap[index] === MapCell.Spoils
            ) && 
            this.checkBombPosition(index)
        );
    }

    checkBombPosition(index) {
        console.log("check-------", this.bombsPosition, index)
        if (this.bombsPosition.includes(index)) {
            return false;
        }
        return true;
    }

    checkSafePosition(index) {
        return (
            index >= 0 &&
            index < this.flatMap.length &&
            (
                this.flatMap[index] === MapCell.Road || 
                this.flatMap[index] === MapCell.Spoils
            )
        );
    }
    
    // Chuyển từ tọa độ x, y sang chỉ số trong flatMap
    getIndexFromCoordinates(x, y) {
        return x * this.mapWidth + y;
    }
    
    // Chuyển từ chỉ số trong flatMap sang tọa độ x, y
    getPositionCoordinates(index) {
        return { x: Math.floor(index / this.mapWidth), y: index % this.mapWidth };
    }
    
    
    // Hàm này sẽ tính toán phạm vi nổ của một quả bomb:
    calculateBombRange(bomb) {
        const bombRange = new Set();
        const { row, col, power } = bomb;
    
        const bombPosition = this.to1dPos(col, row);
    
        bombRange.add(bombPosition); // Vị trí bomb
    
        // Tính toán phạm vi nổ theo 4 hướng
        const directions = [
            { dx: 0, dy: -1 }, // Lên
            { dx: 0, dy: 1 },  // Xuống
            { dx: -1, dy: 0 }, // Trái
            { dx: 1, dy: 0 }   // Phải
        ];
    
        for (const { dx, dy } of directions) {
            for (let i = 1; i <= power; i++) {
                const newRow = row + dy * i;
                const newCol = col + dx * i;
    
                // Nếu vị trí nằm ngoài bản đồ hoặc bị chặn bởi vật cản, dừng lại
                if (newRow < 0 || newRow >= this.mapHeight || newCol < 0 || newCol >= this.mapWidth) {
                    break;
                }
    
                const newPos = this.to1dPos(newCol, newRow);
                const cellValue = this.flatMap[newPos];
    
                bombRange.add(newPos);
    
                if (cellValue !== MapCell.Road && cellValue !== MapCell.GodBadge) {
                    break; // Không xuyên qua vật cản
                }
            }
        }
    
        return bombRange;
    }

    // Hàm này sẽ tìm vị trí gần nhất từ danh sách vị trí an toàn:
    findClosestPosition(currentPosition, positions) {
        let closestPosition = null;
        let minDistance = Infinity;
    
        positions.forEach(pos => {
            const path = this.findPath(currentPosition, pos);
            if (path && path.length < minDistance) {
                minDistance = path.length;
                closestPosition = pos;
            }
        });
    
        return closestPosition;
    }
    
    isValidPosition(pos) {
        if (pos < 0 || pos >= this.flatMap.length) {
            return false; // Vị trí ngoài bản đồ
        }
        const cellValue = this.flatMap[pos];
        return cellValue === MapCell.Road || cellValue === MapCell.GodBadge || cellValue === MapCell.Spoils; // Chỉ cho phép ô trống và GodBadge
    }

    moveTo(path) {
        if (path && path.length > 0) {
            const pathString = path.join(""); // Chuyển path thành chuỗi
            console.log(`Sending full path to driver: ${pathString}`);
            this.emitDriver('drive player', { direction: pathString }); // Gửi toàn bộ path
            this.isMoving = true; // Đặt trạng thái đang di chuyển
    
            // Giả lập hoàn tất sau một thời gian tùy thuộc vào độ dài path
            const estimatedTime = path.length * 500; // Giả sử mỗi bước mất 500ms
            setTimeout(() => {
                this.isMoving = false; // Reset trạng thái
                console.log("Arrived at destination.");
                this.currentTarget = null; // Đặt lại mục tiêu
                this.decideNextAction(); // Thực hiện hành động tiếp theo
            }, estimatedTime);
        } else {
            console.log("No path to move. Resetting state.");
            this.isMoving = false;
            this.currentTarget = null; // Đặt lại mục tiêu
            this.decideNextAction(); // Thực hiện hành động tiếp theo
        }
    }
    
    
    
    
    // Nếu không có vị trí an toàn, nhân vật sẽ di chuyển ra xa bomb theo hướng ngẫu nhiên.
    moveManuallyAwayFromBomb(bombPosition) {
        const directions = [
            { dx: 1, dy: 0 }, // Right
            { dx: -1, dy: 0 }, // Left
            { dx: 0, dy: 1 }, // Down
            { dx: 0, dy: -1 } // Up
        ];
    
        const { x: playerX, y: playerY } = this.to2dPos(this.player.position);
    
        for (const { dx, dy } of directions) {
            const newX = playerX + dx;
            const newY = playerY + dy;
            const newPos = this.to1dPos(newX, newY);
    
            if (this.isValidPosition(newPos)) {
                console.log(`Manually moving to position: ${newPos}`);
                this.moveTo([newPos]);
                return;
            }
        }
    
        console.warn("No valid manual escape moves available.");
    }
    
    
    handleAfterBombExploded() {
        console.log("Bomb exploded! Updating map and deciding next action.");
    
        // Cập nhật lại bản đồ (giả sử bạn đã có logic cập nhật map sau bomb nổ)
        this.updateMapAfterExplosion();
    
        // Gọi decideNextAction để tiếp tục logic
        this.decideNextAction(this.player.playerInfo.hasTransform);
    }


    printMap2D() {
        console.log("Current Map:");
        for (let y = 0; y < this.mapHeight; y++) {
            let row = '';
            for (let x = 0; x < this.mapWidth; x++) {
                const pos = this.to1dPos(x, y); // Chuyển đổi vị trí 2D sang 1D
                row += this.flatMap[pos] + ' '; // Lấy giá trị từ flatMap và thêm khoảng trắng
            }
            console.log(row.trim()); // In dòng đã tạo, loại bỏ khoảng trắng thừa
        }
    }

    printMap2DV2(map) {
        console.log("Current Map:");
        for (let y = 0; y < map.length; y++) { // Duyệt từng hàng
            let row = map[y].join(' '); // Ghép các phần tử của hàng với khoảng trắng
            console.log(row); // In ra hàng đã tạo
        }
    }

    

    playerStopNearbyBomb() {
        const playerPosition = this.to2dPos(this.player.position);
        const map = this.convertFlatTo2Dmap();
    
        // Các tọa độ lân cận cần kiểm tra
        const directions = [
            { dx: -1, dy: 0 },  // Trái
            { dx: 1, dy: 0 },   // Phải
            { dx: 0, dy: -1 },  // Lên
            { dx: 0, dy: 1 },   // Xuống
            { dx: -1, dy: -1 }, // Góc trên-trái
            { dx: 1, dy: 1 },   // Góc dưới-phải
            { dx: -1, dy: 1 },  // Góc dưới-trái
            { dx: 1, dy: -1 }   // Góc trên-phải
        ];
        if (map[playerPosition.y]?.[playerPosition.x] === MapCell.BombZone) {
            return false;
        }
        // Lặp qua các hướng
        for (const { dx, dy } of directions) {
            const newY = playerPosition.y + dy;
            const newX = playerPosition.x + dx;
    
            // Kiểm tra nếu vị trí lân cận là vùng bom
            if (map[newY]?.[newX] === MapCell.BombZone) {
                return true;
            }
        }
        return false
    }



    // Kiem tra neu la ROAD hoac SPOILS thi return true
    safePosition(col, row, map) {
        if(col >= this.mapHeight || row >= this.mapWidth || col < 1 || row < 1 ) {
            return false
        }
        if(map[col][row] == MapCell.Road || map[col][row] == MapCell.Spoils ) {
            return true
        } else {
            return false
        }
    }

    // kiem tra co the di chuyen
    canPassing(col, row, map) {
        if(col >= this.mapHeight || row >= this.mapWidth || col < 1 || row < 1 ) {
            return false
        }
        console.log("canPassing", map[col][row])
        if(
            map[col][row] == MapCell.BombZone || 
            map[col][row] == MapCell.Road || 
            map[col][row] == MapCell.Spoils) {
            return true
        } else {
            return false
        }
    }
    runbomb (fromX, fromY, currentMap) {
        const maxSteps = 5;
        let walk = ''
        if(this.safePosition(fromX + 1, fromY, currentMap)) {
            return '4'
        }
        if(this.safePosition(fromX - 1, fromY, currentMap)) {
            return '3'
        }
        if(this.safePosition(fromX, fromY + 1, currentMap)) {
            return '2'
        }
        if(this.safePosition(fromX, fromY - 1, currentMap)) {
            return '1'
        }
        console.log("walk 1", walk)
        // di xuong
        for (let step = 1; step <= maxSteps; step++) {
            if (this.canPassing(fromX + step, fromY, currentMap)) {
                walk = walk + "4"
            } else {
                break
                
            }
            if(this.safePosition(fromX, fromY + step, currentMap)) {
                return walk
            }
            if (
                this.safePosition(fromX + step, fromY, currentMap) &&
                this.canPassing(fromX + step, fromY + 1, currentMap)
            ) {
                return walk + "2"
            }
            if (
                this.safePosition(fromX + step, fromY, currentMap) &&
                this.canPassing(fromX + step, fromY - 1, currentMap)
            ) {
                return walk + "1"
            }
            console.log("walk 1--------- ??", walk)
        }
        console.log("walk 2", walk)
        // di len
        walk = ''
        for (let step = 1; step <= maxSteps; step++) {
            if (this.canPassing(fromX - step, fromY, currentMap)) {
                walk = walk + "3"
            } else {
                break
            }
            if(this.safePosition(fromX, fromY + step, currentMap)) {
                return walk
            }
            if (
                this.safePosition(fromX - step, fromY, currentMap) &&
                this.canPassing(fromX - step, fromY + 1, currentMap)
            ) {
                return walk + "2"
            }
            if (
                this.safePosition(fromX - step, fromY, currentMap) &&
                this.canPassing(fromX - step, fromY - 1, currentMap)
            ) {
                return walk + "1"
            }

            console.log("walk 2--------- ??", walk)
        }
        console.log("walk 3", walk)
        walk = ''
        // Sang trai
        for (let step = 1; step <= maxSteps; step++) {
            if (this.canPassing(fromX, fromY - step, currentMap)) {
                walk = walk + "1"
            } else {
                break
            }
            if(this.safePosition(fromX, fromY + step, currentMap)) {
                return walk
            }
            console.log("walk" + walk)
            if (
                this.safePosition(fromX, fromY - step, currentMap) &&
                this.canPassing(fromX + 1, fromY - step, currentMap)
            ) {
                console.log(currentMap[fromX + 1][fromY - step])

                return walk + "4"
            }
            if (
                this.safePosition(fromX, fromY - step, currentMap) &&
                this.canPassing(fromX - 1, fromY - step, currentMap)
            ) {
                console.log(currentMap[fromX - 1][fromY - step])

                return walk + "3"
            }
            console.log("walk 3--------- ??", walk)
        }
        console.log("walk 4", walk)

        walk = ''
        // Sang phai
        for (let step = 1; step <= maxSteps; step++) {
    
            if (this.canPassing(fromX, fromY + step, currentMap)) {
                walk = walk + "2"
            } else {
                break
            }
            if(this.safePosition(fromX, fromY + step, currentMap)) {
                return walk
            }
            if (
                this.safePosition(fromX, fromY + step, currentMap) &&
                this.canPassing(fromX + 1, fromY + step, currentMap)
            ) {
                return walk + "4"
            }
            if (
                this.safePosition(fromX, fromY + step, currentMap) &&
                this.canPassing(fromX - 1, fromY + step, currentMap)
            ) {
                return walk + "3"
            }

            console.log("walk 4--------- ??", walk)
        }
    }
}

export { MapCell, MoveDirection, TreeNode, GamePlayer, GameMap };
