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
        console.log("hasTransform----------------------------------", hasTransform)
        // Nếu đã biến hình, bỏ qua GodBadge
        if (hasTransform || hasTransform == undefined) {
            console.log("Player is transformed. Skipping GodBadge.");
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
        if (path.length > 0) {
            this.isMoving = true;
            const nextMove = path.shift();
            console.log(`Moving to direction: ${nextMove}`);
            this.emitDriver('drive player', { direction: nextMove });
    
            setTimeout(() => {
                this.isMoving = false;
                if (path.length > 0) {
                    this.moveToAndWait(path, waitTime); // Tiếp tục di chuyển
                } else {
                    console.log(`Arrived at GodBadge, standing for ${waitTime / 1000} seconds.`);
                    this.isWaitingAtGodBadge = true; // Đặt trạng thái chờ tại GodBadge
                    setTimeout(() => {
                        console.log("Finished standing at GodBadge.");
                        this.isWaitingAtGodBadge = false; // Reset trạng thái sau khi hoàn thành chờ
                        this.decideNextAction(); // Thực hiện hành động tiếp theo
                    }, waitTime);
                }
            }, 500);
        }
    }
    

    moveToAndBreakProperly(path, targetPos) {
        if (path.length > 0) {
            this.isMoving = true;
            const nextMove = path.shift();
            console.log(`Moving towards BrickWall, direction: ${nextMove}`);
            this.emitDriver('drive player', { direction: nextMove });
    
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
}

module.exports = { MapCell, MoveDirection, TreeNode, GamePlayer, GameMap };
