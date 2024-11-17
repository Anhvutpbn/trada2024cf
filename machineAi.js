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

        // Trạng thái emit
        this.emitStatus = false;
        this.isBreaking = false; // Trạng thái đang phá tường
    }

    parseTicktack(id, res) {
        this.map = res.map_info.map;
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        this.player = new GamePlayer(this, currentPlayer);

        this.decideNextAction();
    }

    to1dPos(x, y) {
        return y * this.mapWidth + x;
    }

    to2dPos(pos) {
        const x = pos % this.mapWidth;
        const y = Math.floor(pos / this.mapWidth);
        return { x, y };
    }

    decideNextAction() {
        const playerPosition = this.player.position;

        // 1. Kiểm tra vật phẩm sát bên
        const adjacentItemDir = this.checkAdjacentForItem(playerPosition);
        if (adjacentItemDir !== null) {
            console.log(`Facing item at direction: ${adjacentItemDir}`);
            this.emitDriver('drive player', { direction: adjacentItemDir });
            return;
        }

        // 2. Tìm Huy Hiệu Thần (GodBadge) gần nhất
        const closestGodBadge = this.findClosestCell(playerPosition, MapCell.GodBadge);
        if (closestGodBadge !== null) {
            const pathToBadge = this.findPath(playerPosition, closestGodBadge);
            if (pathToBadge && this.isPathValid(pathToBadge)) { // Chỉ hành động nếu đường hợp lệ
                console.log(`Move to collect GodBadge at position: ${closestGodBadge}`);
                return this.moveTo(pathToBadge);
            }
        }

        // 3. Tìm Tường Gạch (BrickWall) gần nhất
        const closestBrickWall = this.findClosestCell(playerPosition, MapCell.BrickWall);
        if (closestBrickWall !== null) {
            const pathToBrick = this.findPath(playerPosition, closestBrickWall);
            if (pathToBrick) { // Không cần kiểm tra tính hợp lệ vì BrickWall là mục tiêu
                console.log(`Move to destroy BrickWall at position: ${closestBrickWall}`);
                return this.moveToAndBreakProperly(pathToBrick, closestBrickWall);
            }
        }

        console.log("No action possible.");
        return null;
    }

    moveTo(path) {
        if (path.length > 0) {
            const nextMove = path[0];
            this.emitDriver('drive player', { direction: nextMove });
        }
    }

    moveToAndBreakProperly(path, targetPos) {
        if (path.length > 0) {
            const nextMove = path.shift(); // Lấy bước di chuyển đầu tiên
            console.log(`Moving towards BrickWall, direction: ${nextMove}`);
            this.emitDriver('drive player', { direction: nextMove });

            // Kiểm tra nếu đã đến BrickWall
            setTimeout(() => {
                if (path.length === 0) {
                    console.log(`Reached BrickWall at position: ${targetPos}, breaking it!`);
                    this.emitDriver('drive player', { direction: "b" }); // Thực hiện phá tường

                    // Cập nhật map sau khi phá
                    this.updateMapAfterBreaking(targetPos);

                    // Sau khi phá xong, quyết định hành động tiếp theo
                    setTimeout(() => {
                        this.decideNextAction();
                    }, 500); // Cho thời gian hành động tiếp theo
                } else {
                    // Nếu chưa đến, tiếp tục di chuyển
                    this.moveToAndBreakProperly(path, targetPos);
                }
            }, 500); // Delay giữa các bước di chuyển
        }
    }

    updateMapAfterBreaking(targetPos) {
        console.log(`Updating map after breaking BrickWall at position: ${targetPos}`);
        this.flatMap[targetPos] = MapCell.Road; // Biến tường gạch thành đường trống
    }

    checkAdjacentForItem(playerPosition) {
        const neighbors = this.getNeighborNodes(playerPosition);

        for (let neighbor of neighbors) {
            const { pos, dir } = neighbor;

            if (this.flatMap[pos] === MapCell.BrickWall) {
                if (!this.isBreaking) {
                    this.isBreaking = true;
                    console.log(`Breaking BrickWall at direction: ${dir}`);
                    this.emitDriver('drive player', { direction: dir });
                    setTimeout(() => {
                        this.emitDriver('drive player', { direction: "b" });
                        this.updateMapAfterBreaking(pos); // Cập nhật map sau khi phá
                        this.isBreaking = false;

                        // Quyết định hành động tiếp theo
                        this.decideNextAction();
                    }, 500);
                }
                return null;
            }

            if (this.flatMap[pos] === MapCell.GodBadge) {
                return dir;
            }
        }

        return null;
    }

    emitDriver(event, data) {
        if (!this.emitStatus) {
            console.log("emitStatus-----------------------------", event, data)
            this.emitStatus = true; // Đặt trạng thái emit là true
            this.socket.emit(event, data); // Thực hiện emit

            // Đặt lại trạng thái emit sau 0.5 giây
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
                if (path && path.length > 0) { // Đảm bảo có đường hợp lệ
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

    isPathValid(path) {
        // Kiểm tra đường đi chỉ bao gồm ô MapCell.Road
        for (const step of path) {
            const nextPos = this.to2dPos(step);
            const cellValue = this.flatMap[this.to1dPos(nextPos.x, nextPos.y)];
            if (cellValue !== MapCell.Road && cellValue !== MapCell.GodBadge) {
                return false; // Đường không hợp lệ
            }
        }
        return true;
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


module.exports = { MapCell, MoveDirection, TreeNode, GamePlayer, GameMap };
