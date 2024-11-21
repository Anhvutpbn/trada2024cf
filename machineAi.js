// Constants for Map Cells
const MapCell = {
    Road: 0,           // Ô trống (Người chơi có thể đi qua)
    Border: 1,         // Ranh giới Map (Không thể phá hủy)
    Balk: 2,           // Chướng ngại vật (Phá hủy được)
    BrickWall: 3,      // Tường gạch (Dùng Chày gỗ để phá, thường là vật cản tới 'Huy Hiệu Thần')
    Jail: 5,           // Nhà tù
    GodBadge: 6,       // Huy Hiệu Thần (Đứng ở đây 3s để trở thành Bất Tử)
    SpecialZone: 7     // Vùng đất bị phá hủy bởi vũ khí đặc biệt (Có thể di chuyển qua)
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
        console.log("hasTransform:", hasTransform ? "Player is transformed." : "Player is not transformed.");
        this.decideNextAction(hasTransform);
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
            return; // Không gửi lệnh mới nếu đang di chuyển, phá tường, hoặc chờ tại GodBadge
        }
        const playerPosition = this.player.position;
        // Nếu đã biến hình, bỏ qua GodBadge
        if(hasTransform == undefined) { return; }
        else if (hasTransform) {
            console.log("Player is transformed. Switching to bomb logic.");

            // Đảm bảo đang sử dụng bomb
            if (this.player.playerInfo.currentWeapon !== 2) {
                console.log("Switching to bomb weapon...");
                this.socket.emit('action', { action: "switch weapon" });
                this.player.playerInfo.currentWeapon = 2; // Cập nhật trạng thái weapon
                return;
            }

            // Tìm vị trí đặt bomb tối ưu
            const bombPosition = this.findOptimalBombPosition(playerPosition);
            if (bombPosition) {
                console.log(`Optimal bomb position found: ${bombPosition}`);
                return this.placeBombAndRetreat(bombPosition);
            } else {
                console.log("No optimal position to place bomb. TODO: Implement alternative logic.");
                return;
            }
        } else {
            // Ưu tiên đến GodBadge nếu chưa biến hình
            const closestGodBadge = this.findClosestCell(playerPosition, MapCell.GodBadge);
            if (closestGodBadge !== null && this.currentTarget !== closestGodBadge) {
                const pathToBadge = this.findPath(playerPosition, closestGodBadge);
                if (pathToBadge && this.isPathValid(pathToBadge, playerPosition)) {
                    console.log(`Move to GodBadge at position: ${closestGodBadge}`);
                    this.currentTarget = closestGodBadge; // Lưu mục tiêu hiện tại
                    return this.moveToAndWait(pathToBadge, 4000); // Đứng tại GodBadge trong 4 giây
                }
            }
        }
    
        // Nếu đã biến hình hoặc không có GodBadge, thực hiện hành động khác
        const closestBrickWall = this.findClosestCell(playerPosition, MapCell.BrickWall);
        if (closestBrickWall !== null && this.currentTarget !== closestBrickWall) {
            const pathToBrick = this.findPath(playerPosition, closestBrickWall);
            if (pathToBrick) {
                console.log(`Move to destroy BrickWall at position: ${closestBrickWall}`);
                this.currentTarget = closestBrickWall; // Lưu mục tiêu hiện tại
                return this.moveToAndBreakProperly(pathToBrick, closestBrickWall);
            }
        }
    
        console.log("No action possible.");
        this.currentTarget = null;
        return null;
    }
    
    moveToAndWait(path, waitTime) {
        if (path && path.length > 0) {
            console.log(`Sending path to wait at destination: ${path}`);
            this.isMoving = true;
            this.moveTo(path);
    
            setTimeout(() => {
                console.log(`Arrived at destination, waiting for ${waitTime / 1000} seconds.`);
                this.isMoving = false;
                this.isWaitingAtGodBadge = true;
    
                setTimeout(() => {
                    console.log("Finished waiting at GodBadge.");
                    this.isWaitingAtGodBadge = false;
                    this.decideNextAction(); // Tiếp tục hành động tiếp theo
                }, waitTime);
            }, path.length * 500); // Thời gian di chuyển phụ thuộc vào độ dài path
        } else {
            console.log("No valid path to move and wait.");
        }
    }
    

    moveToAndBreakProperly(path, targetPos) {
        if (path.length > 0) {
            this.isMoving = true;
            console.log(`Moving towards BrickWall, direction: ${path}`);
            this.moveTo(path);
    
            setTimeout(() => {
                this.isMoving = false;
                if (path.length === 0) {
                    console.log(`Reached BrickWall at position: ${targetPos}`);
                    if (this.shouldBreak(this.player.position)) {
                        console.log("Breaking BrickWall!");
                        this.isBreaking = true;
                        this.emitDriver('drive player', { direction: "b" });
                        this.updateMapAfterBreaking(targetPos);
    
                        setTimeout(() => {
                            this.isBreaking = false;
                            this.currentTarget = null; // Đặt lại mục tiêu hiện tại sau khi hoàn tất
                            this.decideNextAction(); // Thực hiện hành động tiếp theo
                        }, 500);
                    }
                } else {
                    this.moveToAndBreakProperly(path, targetPos);
                }
            }, 500);
        }
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
        const potentialPositions = new Map(); // Lưu trữ vị trí và số hộp bị phá hủy
    
        // Duyệt qua các ô có Balk để tìm các vị trí gần đó
        this.flatMap.forEach((cell, index) => {
            if (cell === MapCell.Balk) {
                const neighbors = this.getNeighborNodes(index); // Các ô lân cận hộp
                neighbors.forEach(({ pos }) => {
                    if (this.flatMap[pos] === MapCell.Road) {
                        if (!potentialPositions.has(pos)) {
                            const boxesDestroyed = this.calculateBombImpact(pos);
                            potentialPositions.set(pos, boxesDestroyed);
                        }
                    }
                });
            }
        });
    
        // Chọn vị trí tốt nhất (phá được nhiều Balk nhất và không nguy hiểm)
        let bestPosition = null;
        let maxBoxes = 0;
    
        for (const [pos, boxesDestroyed] of potentialPositions) {
            if (boxesDestroyed > maxBoxes) {
                // Kiểm tra xem vị trí này có an toàn không
                const bombImpactArea = this.getBombImpactArea(pos);
                if (!bombImpactArea.has(playerPosition)) {
                    bestPosition = pos;
                    maxBoxes = boxesDestroyed;
                }
            }
        }
    
        return bestPosition;
    }
    
    
    
    
    // Hàm tìm vị trí an toàn
    findSafePosition(bombPosition) {
        const bombImpactArea = this.getBombImpactArea(bombPosition);
    
        // Tìm vị trí ngoài vùng ảnh hưởng
        for (let i = 0; i < this.flatMap.length; i++) {
            if (!bombImpactArea.has(i) && this.flatMap[i] === MapCell.Road) {
                return i; // Trả về vị trí an toàn đầu tiên tìm thấy
            }
        }
    
        return null; // Không tìm thấy vị trí an toàn
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
        if (this.currentTarget === bombPosition) {
            console.log("Already placed bomb at this position. Skipping...");
            return;
        }
    
        console.log(`Placing bomb at position: ${bombPosition}`);
        this.currentTarget = bombPosition;
        this.emitDriver('drive player', { direction: "b" }); // Lệnh đặt bomb
    
        const safePosition = this.findSafePosition(bombPosition);
        if (safePosition !== null) {
            const pathToSafe = this.findPath(this.player.position, safePosition);
            console.log(`Safe position found at ${safePosition}, moving with path: ${pathToSafe}`);
            if (pathToSafe && pathToSafe.length > 0) {
                this.moveTo(pathToSafe);
            }
        } else {
            console.log("No safe position found. Attempting manual escape.");
            this.moveManuallyAwayFromBomb(bombPosition);
        }
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
    
                // Dừng nếu vượt ngoài bản đồ
                if (currentPos < 0 || currentPos >= this.flatMap.length) break;
    
                const cellValue = this.flatMap[currentPos];
                impactArea.add(currentPos);
    
                // Dừng nếu gặp vật cản
                if (cellValue !== MapCell.Road && cellValue !== MapCell.Balk) break;
            }
        });
    
        return impactArea;
    }
    
    // Hàm này sẽ tìm vị trí an toàn (ngoài tầm ảnh hưởng của bomb) và di chuyển đến đó:    
    moveToSafePosition(playerPosition) {
        console.log("Finding safe position...");
    
        // Lấy danh sách các ô trong phạm vi ảnh hưởng của bomb
        const dangerZones = new Set();
        this.bombs.forEach(bomb => {
            const bombPos = this.to1dPos(bomb.col, bomb.row);
            dangerZones.add(bombPos);
    
            // Thêm các ô bị ảnh hưởng bởi bomb (theo power)
            for (let i = 1; i <= bomb.power; i++) {
                // Trên
                const up = this.to1dPos(bomb.col, bomb.row - i);
                if (this.isValidPosition(up)) dangerZones.add(up);
    
                // Dưới
                const down = this.to1dPos(bomb.col, bomb.row + i);
                if (this.isValidPosition(down)) dangerZones.add(down);
    
                // Trái
                const left = this.to1dPos(bomb.col - i, bomb.row);
                if (this.isValidPosition(left)) dangerZones.add(left);
    
                // Phải
                const right = this.to1dPos(bomb.col + i, bomb.row);
                if (this.isValidPosition(right)) dangerZones.add(right);
            }
        });
    
        // Tìm vị trí an toàn gần nhất
        const safePositions = this.flatMap
            .map((cell, index) => ({ cell, index }))
            .filter(({ cell, index }) => cell === MapCell.Road && !dangerZones.has(index)) // Sửa lỗi tại đây
            .map(({ index }) => ({
                index,
                distance: this.getManhattanDistance(playerPosition, index)
            }))
            .sort((a, b) => a.distance - b.distance);
    
        if (safePositions.length > 0) {
            const safePosition = safePositions[0].index;
            console.log(`Safe position found at ${safePosition}`);
            const pathToSafe = this.findPath(playerPosition, safePosition);
            return this.moveTo(pathToSafe); // Di chuyển đến vị trí an toàn
        } else {
            console.log("No safe position available.");
        }
    }
    
    getManhattanDistance(pos1, pos2) {
        const pos1_2d = this.to2dPos(pos1);
        const pos2_2d = this.to2dPos(pos2);

        return Math.abs(pos1_2d.x - pos2_2d.x) + Math.abs(pos1_2d.y - pos2_2d.y);
    }
    
    // Hàm này sẽ tìm tất cả các vị trí trên bản đồ ngoài tầm ảnh hưởng của bomb:
    findSafePosition(bombPosition) {
        const bombImpactArea = this.getBombImpactArea(bombPosition);
    
        const safePositions = this.flatMap
            .map((cell, index) => ({ cell, index }))
            .filter(({ cell, index }) => cell === MapCell.Road && !bombImpactArea.has(index))
            .map(({ index }) => ({
                index,
                distance: this.getManhattanDistance(this.player.position, index)
            }))
            .sort((a, b) => a.distance - b.distance);
    
        // Nếu không có vị trí an toàn, chọn ô bất kỳ không thuộc vùng ảnh hưởng
        if (safePositions.length === 0) {
            for (let i = 0; i < this.flatMap.length; i++) {
                if (this.flatMap[i] === MapCell.Road && !bombImpactArea.has(i)) {
                    return i;
                }
            }
            return null;
        }
    
        return safePositions[0].index;
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
    
        const { x: bombX, y: bombY } = this.to2dPos(bombPosition);
        const { x: playerX, y: playerY } = this.to2dPos(this.player.position);
    
        for (const { dx, dy } of directions) {
            const newX = playerX + dx;
            const newY = playerY + dy;
            const newPos = this.to1dPos(newX, newY);
    
            if (this.isValidPosition(newPos)) {
                console.log(`Manually moving to position: ${newPos}`);
                return this.moveTo([newPos]);
            }
        }
    
        console.log("No valid manual escape moves available.");
    }
    
    
    
}

export { MapCell, MoveDirection, TreeNode, GamePlayer, GameMap };
