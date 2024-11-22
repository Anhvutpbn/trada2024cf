// Constants for Map Cells
const MapCell = {
    Road: 0,           // Ô trống (Người chơi có thể đi qua)
    Border: 1,         // Ranh giới Map (Không thể phá hủy)
    Balk: 2,           // Chướng ngại vật (Phá hủy được)
    BrickWall: 3,      // Tường gạch (Dùng Chày gỗ để phá, thường là vật cản tới 'Huy Hiệu Thần')
    Jail: 5,           // Nhà tù
    GodBadge: 6,       // Huy Hiệu Thần (Đứng ở đây 3s để trở thành Bất Tử)
    SpecialZone: 7,   // Vùng đất bị phá hủy bởi vũ khí đặc biệt (Có thể di chuyển qua)
    BombZone: 77
};

const MoveDirection = {
    LEFT: "1",  // Di chuyển sang trái
    RIGHT: "2", // Di chuyển sang phải
    UP: "3",    // Di chuyển lên trên
    DOWN: "4",  // Di chuyển xuống dưới
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
        // Trạng thái di chuyển và phá tường
        this.emitStatus = false;
        this.isMoving = false;
        this.isBreaking = false;
        this.currentTarget = null;
        this.isWaitingAtGodBadge = false; 

         // Trạng thái đứng yên
         this.lastMoveTime = Date.now(); // Lần cuối cùng di chuyển
         this.lastPosition = null; // Vị trí lần cuối
         this.hasPlacedBomb = false; // Trạng thái: Đã đặt bomb
    }

    parseTicktack(id, res) {
        this.map = res.map_info.map;
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        this.player = new GamePlayer(this, currentPlayer);
    
        const hasTransform = this.player.playerInfo.hasTransform;
        this.bombs = res.map_info.bombs.filter(bomb => bomb.playerId === this.player.playerInfo.id);
        
        console.log("----------------------------------------------------------")
        console.log("----" + this.bombs.length, this.hasPlacedBomb, hasTransform)
        console.log("this.isMoving:  " + this.isMoving)
        console.log("this.bombs:  " , res.map_info.bombs)
        console.log("----------------------------------------------------------")
        
        // Kiểm tra trạng thái đứng yên
        this.checkIdleStatus();
    
        // Lặp qua tất cả các bomb trên bản đồ và tính toán vùng ảnh hưởng
        res.map_info.bombs.forEach(bomb => {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            this.replaceBombImpactWithSpecialZone(bombPosition)
        });
        this.printMap2D();
        console.log("Player position: |" + this.player.position, this.flatMap[this.player.position])        
        if(this.flatMap[this.player.position] == MapCell.BombZone) {
            this.escapeFromDangerZone()
        }
        if (this.bombs.length == 0) {
            this.hasPlacedBomb = false;
        } else {
            this.isMoving = false;
            this.isBreaking = false;
            this.hasPlacedBomb = true;
        }
    
        // Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường
        console.log("Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường", this.hasPlacedBomb)     
        this.decideNextAction(hasTransform);
    }
    
    replaceBombImpactWithSpecialZone(bombPosition) {
        const bombImpactArea = this.getBombImpactArea(bombPosition);
        bombImpactArea.forEach(position => {
            if (this.flatMap[position] !== MapCell.Border) {
                this.flatMap[position] = MapCell.BombZone; // Thay thế bằng số 77
            }
        });
        console.log(`Replaced bomb impact area with Special Zone at positions: ${[...bombImpactArea]}`);
    }

    isPlayerInDangerZone() {
        const playerPosition = this.player.position;
        console.log("POSITION: "+ playerPosition)
        // Duyệt qua tất cả bomb để kiểm tra vùng ảnh hưởng
        return this.bombs.some(bomb => {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            const bombImpactArea = this.getBombImpactArea(bombPosition);
            this.replaceBombImpactWithSpecialZone(bombPosition);
            return bombImpactArea.has(playerPosition);
        });


    }
    
    escapeFromDangerZone() {
        const playerPosition = this.player.position;
    
        // Tìm vị trí an toàn gần nhất
        let safePosition = null;
        for (const bomb of this.bombs) {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            safePosition = this.findSafePosition(bombPosition, true); // Cho phép thoát qua vùng nguy hiểm nếu cần
            if (safePosition !== null) break;
        }
        // console.log(`||||-------safe position: ${safePosition.path}`);
        if (safePosition !== null) {
            if (safePosition.path != null) {
                console.log(`Escaping to safe position: ${safePosition}`);
                this.forceMoveTo(safePosition.path); // Di chuyển ngay lập tức
            } else {
                console.warn("No valid path to safe position. Attempting manual escape.");
                this.forceMoveManuallyAwayFromBomb(playerPosition);
            }
        } else {
            console.warn("No safe position found. Attempting manual escape.");
            this.forceMoveManuallyAwayFromBomb(playerPosition);
        }
    }

    
    checkIdleStatus() {
        const currentPosition = this.player.position;

        if (this.lastPosition === currentPosition) {
            const timeSinceLastMove = Date.now() - this.lastMoveTime;

            if (timeSinceLastMove > 5000) { // Nếu đứng yên quá 7 giây
                console.warn(`Player is idle for more than 7 seconds. Forcing a move.`);
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
        const validNeighbors = neighbors.filter(({ pos }) => this.flatMap[pos] === MapCell.Road);

        if (validNeighbors.length > 0) {
            const randomNeighbor = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
            console.log(`Forced move to direction: ${randomNeighbor.dir}`);
            this.emitDriver('drive player', { direction: randomNeighbor.dir });
        } else {
            console.warn(`No valid moves found for forced movement.`);
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
        console.log(`Updating map after breaking BrickWall at position: ${targetPos}`);
        this.flatMap[targetPos] = MapCell.Road; // Biến tường gạch thành đường trống
    }

    decideNextAction(hasTransform) {
        if (this.isMoving || this.isBreaking || this.isWaitingAtGodBadge) {
            console.log("Currently busy with another action. Skipping decideNextAction.");
            return; // Không thực hiện thêm hành động khi đang bận
        }
    
        const playerPosition = this.player.position;
        console.warn("-------=-------------------");
        if (hasTransform === undefined) {
            console.warn("Transform state is undefined. Skipping action.");
            return;
        }
        console.warn("Nếu đã transformed, chỉ đặt bomb và tránh vùng nổ");
        // Nếu đã transformed, chỉ đặt bomb và tránh vùng nổ
        if (hasTransform) {
            console.log("Player is transformed. Switching to bomb logic.");
    
            if (this.player.playerInfo.currentWeapon !== 2) {
                console.log("Switching to bomb weapon...");
                this.socket.emit('action', { action: "switch weapon" });
                this.player.playerInfo.currentWeapon = 2; // Cập nhật trạng thái weapon
                return;
            }
    
            if (!this.hasPlacedBomb) {
                console.log("-----------placeBombAndRetreat Find path plan")
                const bombPosition = this.findOptimalBombPosition(playerPosition);
                console.log("-----------placeBombAndRetreat Find path plan result ", bombPosition)
                if (bombPosition) {
                    this.placeBombAndRetreat(bombPosition);
                    console.log("-----------placeBombAndRetreat")  
                    return;
                } else {
                    console.log("No optimal bomb position found. Waiting for next action.");
                    return;
                }
            } else {
                console.log("Bomb is already placed. Waiting for next action.");
                return;
            }
        }
    
        // Ưu tiên đến GodBadge nếu chưa transformed
        const closestGodBadge = this.findClosestCell(playerPosition, MapCell.GodBadge);
        if (closestGodBadge !== null && this.currentTarget !== closestGodBadge) {
            const pathToBadge = this.findPath(playerPosition, closestGodBadge);
    
            if (pathToBadge && this.isPathValid(pathToBadge, playerPosition)) {
                console.log(`Moving to GodBadge at position: ${closestGodBadge}`);
                this.currentTarget = closestGodBadge;
                this.moveToAndWait(pathToBadge, 3000); // Đứng tại GodBadge trong 3 giây
                return;
            } else {
                console.warn("No valid path to GodBadge or path is invalid.");
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
            } else {
                console.warn("Unable to find a valid path to BrickWall.");
            }
        }
    
        console.log("No action possible. Resetting state.");
        this.currentTarget = null;
    }
    
    
    moveToAndWait(path, waitTime) {
        if (path && path.length > 0) {
            console.log(`Sending path to wait at destination: ${path}`);
            this.isMoving = true;
            this.moveTo(path);
    
            setTimeout(() => {
                console.log(`Arrived at GodBadge, starting wait for ${waitTime / 1000} seconds.`);
                this.isMoving = false;
                this.isWaitingAtGodBadge = true;
    
                // Chờ 3 giây tại GodBadge
                setTimeout(() => {
                    console.log("Finished waiting at GodBadge.");
                    this.isWaitingAtGodBadge = false;
                    this.decideNextAction(); // Tiếp tục hành động tiếp theo
                }, waitTime);
            }, path.length * 500); // Thời gian di chuyển phụ thuộc vào độ dài path
        } else {
            this.isMoving = false;
            console.log("No valid path to move and wait.");
        }
    }
    
    

    moveToAndBreakProperly(path, targetPos) {
        if (path.length > 0) {
            console.log(`Moving towards BrickWall, path: ${path}`);
            this.isMoving = true;
            this.moveTo(path); // Di chuyển đến gần tường gạch
    
            // Sau khi di chuyển xong
            setTimeout(() => {
                this.isMoving = false;
    
                const playerPosition = this.player.position;
                const directionToBrick = this.getDirectionToNeighbor(playerPosition, targetPos);
    
                if (directionToBrick) {
                    console.log(`Facing BrickWall, direction: ${directionToBrick}`);
                    this.emitDriver('drive player', { direction: directionToBrick }); // Quay mặt vào tường
    
                    setTimeout(() => {
                        console.log(`Breaking BrickWall at position: ${targetPos}`);
                        this.emitDriver('drive player', { direction: "b" }); // Phá tường
    
                        // Cập nhật bản đồ sau khi phá tường
                        this.updateMapAfterBreaking(targetPos);
    
                        // Kiểm tra và phá tiếp các tường xung quanh nếu có
                        setTimeout(() => {
                            this.isBreaking = false;
                            this.breakSurroundingBrickWalls(); // Kiểm tra và phá tiếp các tường xung quanh
                        }, 200);
                    }, 300); // Đợi sau khi quay mặt để phá tường
                } else {
                    console.warn(`Unable to face the BrickWall at position: ${targetPos}`);
                }
            }, path.length * 500); // Thời gian chờ phụ thuộc vào độ dài đường đi
        } else {
            console.warn(`Path to BrickWall is empty, cannot proceed.`);
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
                console.log(`Found another BrickWall at position: ${pos}, direction: ${dir}`);
                
                // Quay mặt vào tường gạch
                this.emitDriver('drive player', { direction: dir });
    
                setTimeout(() => {
                    console.log(`Breaking BrickWall at position: ${pos}`);
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
    
        console.log("No more BrickWalls surrounding the player.");
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
            console.log(`Emitting event: ${event} with data:`, data);
            this.emitStatus = true;
            this.socket.emit(event, data);

            setTimeout(() => {
                this.emitStatus = false;
            }, 500);
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
            if (cellValue !== MapCell.Road && cellValue !== MapCell.GodBadge) {
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
    findOptimalBombPosition(playerPosition) {
        // Tìm vị trí hộp (Balk) gần nhất
        const queue = [{ position: playerPosition, path: [] }];
        const visited = new Set();
        let optimalPosition = null;
    
        while (queue.length > 0) {
            const { position, path } = queue.shift();
            if (visited.has(position)) continue;
            visited.add(position);
    
            // Kiểm tra các ô lân cận
            const neighbors = this.getNeighborNodes(position);
            for (const { pos } of neighbors) {
                if (visited.has(pos)) continue;
    
                if (this.flatMap[pos] === MapCell.Balk) {
                    // Tìm ô đường trống gần hộp để đặt bomb
                    const safeNeighbors = this.getNeighborNodes(pos).filter(
                        ({ pos: neighborPos }) => this.flatMap[neighborPos] === MapCell.Road
                    );
    
                    for (const { pos: bombPosition } of safeNeighbors) {
                        if (this.isSafeToPlaceBomb(bombPosition)) {
                            optimalPosition = bombPosition;
                            console.log(`Found optimal bomb position: ${optimalPosition}`);
                            return optimalPosition;
                        }
                    }
                } else if (this.flatMap[pos] === MapCell.Road) {
                    queue.push({ position: pos, path: [...path, pos] });
                }
            }
        }
    
        console.warn("No optimal bomb position found.");
        return null;
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
                if (cellValue !== MapCell.Road && cellValue !== MapCell.Balk) {
                    break; // Gặp vật cản thì dừng
                }
            }
        });
    
        return impactCount;
    }
    

    // Hàm đặt bomb và di chuyển đến vị trí an toàn
    placeBombAndRetreat(bombPosition) {
        console.log(`Placing bomb at position: ${bombPosition}`);
        this.emitDriver('drive player', { direction: "b" });
    }
    
    forceMoveTo(path) {
        if (path && path.length > 0) {
            // const pathString = path.join("");
            console.log(`Forcing move to path: ${path}`);
            this.socket.emit('drive player', { direction: path }); // Bỏ qua cooldown
            this.isMoving = true;
            setTimeout(() => {
                this.isMoving = false;
                console.log("Arrived at safe position.");
                this.currentTarget = null;
            }, path.length * 1000); // Ước lượng thời gian di chuyển
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
        impactArea.add(bombPosition);
    
        const directions = [MoveDirection.UP, MoveDirection.DOWN, MoveDirection.LEFT, MoveDirection.RIGHT];
        directions.forEach(dir => {
            let currentPos = bombPosition;
            for (let i = 0; i < this.player.playerInfo.power; i++) {
                const { x, y } = this.to2dPos(currentPos);
                if (dir === MoveDirection.UP) currentPos = this.to1dPos(x, y - 1);
                if (dir === MoveDirection.DOWN) currentPos = this.to1dPos(x, y + 1);
                if (dir === MoveDirection.LEFT) currentPos = this.to1dPos(x - 1, y);
                if (dir === MoveDirection.RIGHT) currentPos = this.to1dPos(x + 1, y);
    
                if (currentPos < 0 || currentPos >= this.flatMap.length) break;
    
                const cellValue = this.flatMap[currentPos];
                impactArea.add(currentPos);
    
                if (cellValue !== MapCell.Road && cellValue !== MapCell.Balk) break;
            }
        });
    
        return impactArea;
    }
    
    getManhattanDistance(pos1, pos2) {
        const pos1_2d = this.to2dPos(pos1);
        const pos2_2d = this.to2dPos(pos2);

        return Math.abs(pos1_2d.x - pos2_2d.x) + Math.abs(pos1_2d.y - pos2_2d.y);
    }
    
    findSafePosition(bombPosition) {
        const maxSteps = 9; // Số bước tối đa
        const directions = [
            { dx: 1, dy: 0, code: "4" }, // Đi xuống
            { dx: -1, dy: 0, code: "3" }, // Đi lên
            { dx: 0, dy: -1, code: "1" }, // Sang trái
            { dx: 0, dy: 1, code: "2" }, // Sang phải
        ];
    
        const { x: fromX, y: fromY } = this.getPositionCoordinates(this.player.position);
    
        for (const direction of directions) {
            let walk = "";
            for (let step = 1; step <= maxSteps; step++) {
                const newX = fromX + step * direction.dx;
                const newY = fromY + step * direction.dy;
                const newIndex = this.getIndexFromCoordinates(newX, newY);
    
                if (this.checkSafeMove(newIndex)) {
                    walk += direction.code;
    
                    // Kiểm tra nếu ô tiếp theo hoàn toàn an toàn
                    const nextX = newX + direction.dx;
                    const nextY = newY + direction.dy;
                    const nextIndex = this.getIndexFromCoordinates(nextX, nextY);
    
                    if (this.checkSafeMove(nextIndex)) {
                        return { index: nextIndex, path: walk + direction.code }; // Di chuyển thêm 1 bước nữa
                    }
                } else {
                    break; // Nếu không đi tiếp được, thoát khỏi vòng lặp
                }
            }
        }
    
        console.log("No valid positions available.");
        return null; // Không tìm thấy vị trí an toàn
    }
    
    
    // Hàm kiểm tra vị trí có an toàn không
    checkSafeMove(index) {
        return (
            index >= 0 &&
            index < this.flatMap.length &&
            (this.flatMap[index] === MapCell.Road || this.flatMap[index] === MapCell.BombZone)
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
        return cellValue === MapCell.Road || cellValue === MapCell.GodBadge; // Chỉ cho phép ô trống và GodBadge
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
}

export { MapCell, MoveDirection, TreeNode, GamePlayer, GameMap };
