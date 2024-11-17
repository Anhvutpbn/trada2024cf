
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


const AllCellTypes = new Set(Object.values(MapCell));

// Constants for Player States
const PlayerState = {
    speed: 230,       // Tốc độ di chuyển
    power: 1,         // Sức mạnh (tầm nổ bom)
    delay: 2000,      // Độ trễ trước khi đặt bom tiếp
    lives: 1000,      // Số mạng sống
    hasTransform: false, // Có trạng thái biến hình không
    isStun: false,    // Bị làm choáng
};

const PlayerItems = {
    box: 0,                 // Hộp
    stickyRice: 0,          // Gạo nếp
    chungCake: 0,           // Bánh chưng
    nineTuskElephant: 0,    // Voi 9 ngà
    nineSpurRooster: 0,     // Gà 9 cựa
    nineManeHairHorse: 0,   // Ngựa 9 hồng mao
    holySpiritStone: 0,     // Đá thần thánh
    eternalBadge: 0,        // Huy hiệu vĩnh cửu
    brickWall: 0,           // Tường gạch
};

// Constants for Map Information
const MapInfo = {
    cols: 26,  // Số cột
    rows: 14,  // Số hàng
    cellSize: 35, // Kích thước mỗi ô
};

const GameStatus = {
    remainTime: 0, // Thời gian còn lại
    tag: "update-data", // Trạng thái cập nhật
};

const MoveDirection = {
    LEFT: "1",  // Di chuyển sang trái
    RIGHT: "2", // Di chuyển sang phải
    UP: "3",    // Di chuyển lên trên
    DOWN: "4",  // Di chuyển xuống dưới
};

// Base Functions (Skeleton)
class TreeNode {
    constructor(val, dir = null, parent = null) {
        this.val = val;
        this.dir = dir;
        this.parent = parent;
        this.children = [];
        this.distance = parent ? parent.distance + 1 : 0;
        this.bonusPoints = parent ? parent.bonusPoints : 0;
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
        this.mapWidth = MapInfo.cols;
        this.mapHeight = MapInfo.rows;
        this.player = null;
    }

    parseTicktack(id, res) {
        // 1. Cập nhật thông tin bản đồ và người chơi
        this.map = res.map_info.map;
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        this.player = new GamePlayer(this, currentPlayer);
    
        // 2. Quyết định hành động tiếp theo
        this.decideNextAction();
        console.log(id)
    }

    to1dPos(x, y) {
        return y * this.mapWidth + x;
    }

    to2dPos(pos) {
        const x = pos % this.mapWidth;
        const y = Math.floor(pos / this.mapWidth);
        return { x, y };
    }

    getManhattanDistance(pos1, pos2) {
        const pos1_2d = this.to2dPos(pos1);
        const pos2_2d = this.to2dPos(pos2);
        return Math.abs(pos1_2d.x - pos2_2d.x) + Math.abs(pos1_2d.y - pos2_2d.y);
    }
    
    // Hàm tìm ô gần nhất từ vị trí người chơi
    findClosestCell(playerPosition, cellType) {
        let closestCell = null;
        let minDistance = Infinity;
    
        this.flatMap.forEach((cell, index) => {
            if (cell === cellType) {
                const path = this.findPath(playerPosition, index); // Tìm đường đi
                if (path && path.length > 0) { // Chỉ chọn mục tiêu có thể tiếp cận
                    const distance = path.length; // Độ dài đường đi
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCell = index;
                    }
                }
            }
        });
    
        return closestCell; // Trả về vị trí của ô gần nhất có thể tiếp cận
    }

    // Hàm ưu tiên hành động
    decideNextAction() {
        const playerPosition = this.player.position;
    
        // 1. Kiểm tra vật phẩm sát bên
        const adjacentItemDir = this.checkAdjacentForItem(playerPosition);
        if (adjacentItemDir !== null) {
            console.log(`Facing item at direction: ${adjacentItemDir}`);
            this.socket.emit('drive player', { direction: adjacentItemDir }); // Quay mặt vào vật phẩm
            return; // Không thực hiện thêm hành động nào khác
        }
    
        // 2. Tìm Huy Hiệu Thần (GodBadge) gần nhất
        const closestGodBadge = this.findClosestCell(playerPosition, MapCell.GodBadge);
        if (closestGodBadge !== null) {
            console.log(`Move to collect GodBadge at position: ${closestGodBadge}`);
            return this.moveTo(closestGodBadge); // Di chuyển đến Huy Hiệu Thần
        }
    
        // 3. Tìm Tường Gạch (BrickWall) gần nhất
        const closestBrickWall = this.findClosestCell(playerPosition, MapCell.BrickWall);
        if (closestBrickWall !== null) {
            console.log(`Move to destroy BrickWall at position: ${closestBrickWall}`);
            return this.moveTo(closestBrickWall); // Di chuyển đến Tường Gạch
        }
    
        console.log("No action possible.");
        return null; // Không có hành động nào phù hợp
    }
    
    
    

    // Hàm di chuyển người chơi
    moveTo(targetPos) {
        const path = this.findPath(this.player.position, targetPos); // Sử dụng thuật toán tìm đường (ví dụ: BFS, A*)
        if (path && path.length > 0) {
            const nextMove = path[0]; // Lấy bước đi đầu tiên trong đường đi
            this.socket.emit('drive player', { direction: nextMove }); // Gửi lệnh di chuyển
            console.log(`Moving to position: ${nextMove}`);
        } else {
            console.log("No valid path found.");
        }
    }
    
    // Hàm tìm đường
    scanRawMap(startNode, map, callback, withTeleport = false) {
        const queue = [startNode]; // Khởi tạo hàng đợi cho BFS
        const visited = new Set([startNode.val]); // Đánh dấu đã thăm
    
        while (queue.length) {
            const currentNode = queue.shift(); // Lấy nút đầu tiên ra khỏi hàng đợi
    
            // Xử lý logic callback nếu được cung cấp
            if (callback) {
                const [result, ignoreThisNode] = callback(currentNode);
                if (ignoreThisNode) continue; // Nếu cần bỏ qua nút này
                if (result) return result; // Nếu tìm thấy nút mong muốn
            }
    
            // Lấy các ô lân cận
            const neighbors = this.getNeighborNodes(currentNode.val);
            for (let neighbor of neighbors) {
                const { pos, dir } = neighbor;
                const cellValue = map[pos];
    
                // Chỉ thêm ô hợp lệ vào hàng đợi
                if (cellValue === MapCell.Road || (withTeleport && cellValue === MapCell.TeleportGate)) {
                    if (!visited.has(pos)) {
                        visited.add(pos); // Đánh dấu đã thăm
                        const neighborNode = new TreeNode(pos, dir, currentNode);
                        currentNode.children.push(neighborNode);
                        queue.push(neighborNode); // Thêm nút vào hàng đợi
                    }
                }
            }
        }
    
        return null; // Không tìm thấy đường đi
    }
    

    // Lấy ô lân cận 
    getNeighborNodes(val) {
        const cols = this.mapWidth;
    
        return [
            { pos: val - cols, dir: MoveDirection.UP },    // Lên
            { pos: val + cols, dir: MoveDirection.DOWN },  // Xuống
            { pos: val - 1, dir: MoveDirection.LEFT },     // Trái
            { pos: val + 1, dir: MoveDirection.RIGHT },    // Phải
        ].filter(neighbor => neighbor.pos >= 0 && neighbor.pos < this.flatMap.length); // Lọc ô hợp lệ
    }
    
    
    findPath(startPos, targetPos) {
        const startNode = new TreeNode(startPos); // Khởi tạo nút bắt đầu
        const resultNode = this.scanRawMap(startNode, this.flatMap, (currentNode) => {
            if (currentNode.val === targetPos) {
                return [currentNode, false]; // Trả về nút đích nếu tìm thấy
            }
            return [null, false]; // Tiếp tục duyệt
        });
    
        // Tìm đường từ nút kết quả (nếu có)
        if (resultNode) {
            const path = [];
            let node = resultNode;
            while (node.parent) {
                path.unshift(node.dir); // Xây dựng chuỗi đường đi
                node = node.parent;
            }
            return path; // Trả về danh sách các bước di chuyển
        }
    
        return null; // Không tìm thấy đường đi
    }

    checkAdjacentForItem(playerPosition) {
        const neighbors = this.getNeighborNodes(playerPosition); // Lấy các ô lân cận
    
        for (let neighbor of neighbors) {
            const { pos, dir } = neighbor;
    
            if (this.flatMap[pos] === MapCell.BrickWall) {
                return dir + "b"; // Quay mặt và phá Tường Gạch
            }
    
            if (this.flatMap[pos] === MapCell.GodBadge) {
                return dir; // Quay mặt vào Huy Hiệu Thần
            }
        }
    
        return null; // Không có vật phẩm sát bên
    }
    
    
}

module.exports = { MapCell, AllCellTypes, PlayerState, PlayerItems, MapInfo, GameStatus, TreeNode, GamePlayer, GameMap };
