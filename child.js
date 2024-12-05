// Constants for Map Cells
const MapCellChild = {
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


const MoveDirectionChild = {
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
class TreeNodeChild {
    constructor(val, dir = null, parent = null) {
        this.val = val;
        this.dir = dir;
        this.parent = parent;
        this.children = [];
        this.distance = parent ? parent.distance + 1 : 0;
    }
}


class GamePlayerChild {
    constructor(gameMap, playerInfo) {
        this.position = gameMap.to1dPos(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
        this.playerInfo = playerInfo;
    }

    setPlayerInfo(playerInfo) {
        this.playerInfo = playerInfo
    }

    setPosition(gameMap, playerInfo) {
        this.position = gameMap.to1dPos(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
    }
}

class GameMapChild {
    constructor(socket, playerId) {
        this.socket = socket;
        this.playerId = playerId+"_child";
        this.playerFather = playerId;
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
         this.caculatorResetTime = 0;

         // kiểm tra việc sử dụng vũ khí thần
         this.parentSkill = true
         this.childSkill = true
         this.oldBomb = {}
    }
    reset() {
        // Đặt lại tất cả các biến về giá trị mặc định
        this.map = [];
        this.flatMap = [];
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
        this.caculatorResetTime = 0;
    }
    async parseTicktack(res) {
        const currentPlayer = res.map_info.players.find(p => this.playerId == p.id);
        if(!currentPlayer || currentPlayer == undefined) {
            return
        }
        this.caculatorResetTime++
        // console.log("this.caculatorResetTime....", this.caculatorResetTime)

        this.map = res.map_info.map;

        const enemies = res.map_info.players.filter(
            p => p.id !== this.playerId && p.id !== this.playerFather
          );
          
        if (enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy !== undefined && enemy.currentPosition !== undefined && enemy.currentPosition.col !== undefined) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MapCellChild.Balk;
                }
            });
        }
        
        // Kiem tra dich da hoa than hay chua
        const nonChildEnemies = enemies.filter(enemy => !enemy.id.endsWith('_child'));
        nonChildEnemies.forEach(enemy => {
            if (!enemy.hasTransform) {
                if (enemy.currentPosition.col !== undefined) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MapCellChild.Border;
                }
            }
        });

        this.replaceValuesInRadius(
            currentPlayer.currentPosition.row, 
            currentPlayer.currentPosition.col,
            12, 
            MapCellChild.SpecialZone, 
            MapCellChild.Road
        )
        // check vij trí búa
        
        if(res.map_info.weaponHammers.length > 0) {
            this.updateMapWithICBM(res.map_info.weaponHammers, MapCellChild.BombZone)
        }
        
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        this.spoils = res.map_info.spoils;
        
        if(this.player) {
            this.player.setPlayerInfo(currentPlayer)
            this.player.setPosition(this, currentPlayer)
        } else {
            this.player = new GamePlayerChild(this, currentPlayer);
        }
        
        this.bombsPosition = []
        this.bombs = res.map_info.bombs.filter(bomb => bomb.playerId === this.player.playerInfo.id);
    
        // Lặp qua tất cả các bomb trên bản đồ và tính toán vùng ảnh hưởng
        for (const bomb of res.map_info.bombs) {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            this.replaceBombImpactWithSpecialZone(bombPosition, bomb.power, bomb.remainTime); // Đảm bảo chờ tác vụ bất đồng bộ
        }
        
        
        if(this.flatMap[this.player.position] == MapCellChild.BombZone) {
            this.awayFromBom = true
            const spoilsPath = this.findEscapePath(); // Tìm đường thoát trong bán kính 5 ô
            await this.socket.emit('drive player', { direction: spoilsPath, "characterType": "child" });
            return
        }
        

        
        this.replaceSpoilsToMapValue()
        // Kiểm tra trạng thái đứng yên
        this.checkIdleStatus();

        if (enemies.length > 0 && this.parentSkill) {
            for (const enemy of enemies) {
                
                const isChild = enemy.id.endsWith('_child'); // Kiểm tra nếu ID kết thúc bằng '_child'
        
                if (
                    enemy !== undefined &&
                    this.player.playerInfo.timeToUseSpecialWeapons &&
                    this.isWithinRadius(
                        currentPlayer.currentPosition.row,
                        currentPlayer.currentPosition.col,
                        enemy.currentPosition.row,
                        enemy.currentPosition.col,
                        6
                    ) &&
                    (isChild || enemy.hasTransform) // Nếu là _child hoặc có hasTransform
                ) {
                    if (enemy.currentPosition.col !== undefined) {
                        this.parentSkill = false 
                        await this.socket.emit("action", {
                            action: "use weapon", 
                            "characterType": "child",
                            payload: {
                                destination: {
                                    col: enemy.currentPosition.col,
                                    row: enemy.currentPosition.row
                                }
                            }
                        });
                        setTimeout(() => {
                            this.parentSkill = true 
                        }, 10000);
                    }
                    // Dừng loop ngay khi tìm thấy enemy phù hợp
                    break;
                }
            }
        }

        if(this.playerStopNearbyBomb()) {
            await this.emitDriver('drive player', { direction: 'x', "characterType": "child"});
        }
        // Picking Item TODO
        if (this.bombs.length == 0 && !this.isWaitingAtGodBadge) {
            const spoilsPath = this.getItem(); // Tìm Spoils trong bán kính 5 ô
                if (spoilsPath) {
                    this.socket.emit('drive player', { direction: spoilsPath, "characterType": "child" });
                } else {
                    // return this.decideNextAction(hasTransform);
                }
            // return;
        }
        const map2 = this.convertFlatTo2Dmap();
        // this.print2DArray(map2)
        // Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường
        // console.log("Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường", this.hasPlacedBomb)     
        return this.decideNextAction();
    }

    // Tinh toan diem no cua qua bomb
    replaceBombImpactWithSpecialZone(bombPosition, bomb) {
        const power = bomb.power;
        const remainTime = bomb.remainTime;
        const createdAt = bomb.createdAt; // Timestamp
        const currentTime = Date.now();
        const bombImpactArea = this.getBombImpactArea(bombPosition, power);
    
        // Lưu vùng nổ vào `oldBomb` với key là `createdAt`
        this.oldBomb[createdAt] = bombImpactArea;
    
        // Xóa các bản ghi cũ hơn 500ms
        for (const [key, impactArea] of Object.entries(this.oldBomb)) {
            if (currentTime - parseInt(key, 10) > 3000) {
                delete this.oldBomb[key];
            } else {
                // Thay thế giá trị trong `flatMap`
                impactArea.forEach(position => {
                    if (this.flatMap[position] !== MapCell.Border) {
                        this.flatMap[position] = MapCell.BombZone; // Thay thế bằng số 77
                    }
                });
            }
        }
    
        bombImpactArea.forEach(position => {
            if (this.flatMap[position] !== MapCell.Border) {
                this.flatMap[position] = MapCell.BombZone; // Thay thế bằng số 77
            }
        });
    }


    // tim duong thoat
    findEscapePath() {
        const playerPosition = this.to2dPos(this.player.position);
        const map = this.convertFlatTo2Dmap();
        const startRow = playerPosition.y;
        const startCol = playerPosition.x;
        const radius = 8;
    // this.print2DArray(map)
        const directions = [
            { row: 0, col: -1, move: MoveDirectionChild.LEFT },
            { row: 0, col: 1, move: MoveDirectionChild.RIGHT },
            { row: -1, col: 0, move: MoveDirectionChild.UP },
            { row: 1, col: 0, move: MoveDirectionChild.DOWN },
        ];
    
        const rows = map.length;
        const cols = map[0].length;
    
        // Xác định nếu bắt đầu trong ô 77
        const isIn77 = map[startRow][startCol] === 77;
        const isValid = (row, col, visited) => {
            return (
                row >= 0 &&
                row < rows &&
                col >= 0 &&
                col < cols &&
                (
                    (isIn77 && (map[row][col] === 77 || map[row][col] === 0 || map[row][col] === 99)) ||
                    (!isIn77 && (map[row][col] === 0 || map[row][col] === 99))
                ) &&
                !visited[row][col]
            );
        };
    
        const queue = [{ row: startRow, col: startCol, path: "" }]; // Bắt đầu với chuỗi rỗng
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        visited[startRow][startCol] = true;
    
        while (queue.length > 0) {
            const { row, col, path } = queue.shift();
    
            // Kiểm tra nếu tìm thấy đích
            if (map[row][col] === MapCellChild.Spoils || map[row][col] === MapCellChild.Road) {
                // console.log(`--------findEscapePath---${path}---------`);
                return path; // Trả về chuỗi đường đi
            }
    
            // Duyệt qua các hướng
            for (const { row: dr, col: dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
    
                // Tính khoảng cách Euclidean
                const distance = Math.sqrt(Math.pow(newRow - startRow, 2) + Math.pow(newCol - startCol, 2));
                if (distance > radius) continue; // Bỏ qua nếu ngoài bán kính
    
                if (isValid(newRow, newCol, visited)) {
                    visited[newRow][newCol] = true;
                    queue.push({ row: newRow, col: newCol, path: path + move }); // Nối hướng di chuyển vào chuỗi
                }
            }
        }
    
        // Không tìm thấy đường đi
        return null;
    }

    replaceValuesInRadius(centerRow, centerCol, radius, targetValue, newValue) {
        // Duyệt qua các hàng trong phạm vi bán kính
        for (let row = Math.max(0, centerRow - radius); row <= Math.min(this.map.length - 1, centerRow + radius); row++) {
            // Duyệt qua các cột trong phạm vi bán kính
            for (let col = Math.max(0, centerCol - radius); col <= Math.min(this.map[row].length - 1, centerCol + radius); col++) {
                // Kiểm tra nếu nằm trong bán kính bằng khoảng cách Euclidean
                const distance = Math.sqrt(Math.pow(centerRow - row, 2) + Math.pow(centerCol - col, 2));
                if (distance <= radius && this.map[row][col] === targetValue) {
                    this.map[row][col] = newValue; // Thay giá trị nếu thỏa mãn
                }
            }
        }
        return true;
    }
    
    // replace vị trí rìu thần thành dranger zone để né. Còn né được hay không thì .. 
    updateMapWithICBM(players, replacementValue) {
        players.forEach((player) => {
            const { destination, power } = player;
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
                    if (distance <= radius && (this.map[row][col] === MapCellChild.Road || this.map[row][col] == MapCellChild.Spoils)) {
                        // Thay thế giá trị nếu trong bán kính và giá trị bằng 0
                        this.map[row][col] = replacementValue;
                    }
                }
            }
        });
        return true;
    }

    to1dPos(x, y) {

        return y * this.mapWidth + x;
    }

    to2dPos(pos) {
        const x = pos % this.mapWidth;
        const y = Math.floor(pos / this.mapWidth);
        return { x, y };
    }

        // Hàm xác định vùng ảnh hưởng của bomb
        getBombImpactArea(bombPosition, power) {
            const impactArea = new Set();
            impactArea.add(bombPosition); // Thêm tâm bom vào vùng ảnh hưởng
            const directions = [MoveDirectionChild.UP, MoveDirectionChild.DOWN, MoveDirectionChild.LEFT, MoveDirectionChild.RIGHT];
            // Duyệt qua từng hướng (Lên, Xuống, Trái, Phải)
            directions.forEach(dir => {
                let currentPos = bombPosition;
                // Tính toán vùng ảnh hưởng trong phạm vi sức mạnh của người chơi
                for (let i = 1; i <= power, power; i++) {
                    const { x, y } = this.to2dPos(currentPos);
                    // Di chuyển theo hướng tương ứng
                    let newX = x, newY = y;
                    if (dir === MoveDirectionChild.UP) newY -= 1;
                    if (dir === MoveDirectionChild.DOWN) newY += 1;
                    if (dir === MoveDirectionChild.LEFT) newX -= 1;
                    if (dir === MoveDirectionChild.RIGHT) newX += 1;
                    // Chuyển từ tọa độ 2D sang tọa độ 1D
                    const newIndex = this.to1dPos(newX, newY);
                    // Kiểm tra nếu vị trí nằm ngoài bản đồ
                    if (newIndex < 0 || newIndex >= this.flatMap.length) break;
                    const cellValue = this.flatMap[newIndex];
                    // Nếu gặp khối không thể xuyên qua, dừng lại và không thêm khối đó vào vùng nổ
                    if ( cellValue != MapCellChild.Road && cellValue != MapCellChild.Spoils) {
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

    
        replaceSpoilsToMapValue() {
            // Kiểm tra dữ liệu spoils
            if (!this.spoils || !Array.isArray(this.spoils)) {
                console.error("Spoils data is invalid or undefined:", this.spoils);
                return;
            }
            // Duyệt qua tất cả các item trong this.spoils
            this.spoils.forEach(spoil => {
                const { row, col } = spoil;
        
                // Tính chỉ số phẳng (1D) từ tọa độ 2D
                const index = this.to1dPos(col, row);
        
        
                // Kiểm tra chỉ số hợp lệ trước khi thay thế
                if (index >= 0 && index < this.flatMap.length) {
                    this.flatMap[index] = MapCellChild.Spoils; // Gán giá trị 99
                }
            });
        }

        checkIdleStatus() {
            const currentPosition = this.player.position;
    
            if (this.lastPosition === currentPosition) {
                const timeSinceLastMove = Date.now() - this.lastMoveTime;
    
                if (timeSinceLastMove > 7000) { // Nếu đứng yên quá 7 giây
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

    // kiểm tra vị trí của địch. có nằm trong tầm xả không
    isWithinRadius(centerRow, centerCol, targetRow, targetCol, radius) {
        // Tính khoảng cách Euclidean
        const distance = Math.sqrt(Math.pow(centerRow - targetRow, 2) + Math.pow(centerCol - targetCol, 2));
        
        // Kiểm tra nếu khoảng cách nằm trong bán kính nhưng không nhỏ hơn 3
        return distance <= radius && distance >= 3;
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
        if (map[playerPosition.y]?.[playerPosition.x] === MapCellChild.BombZone) {
            return false;
        }
        // Lặp qua các hướng
        for (const { dx, dy } of directions) {
            const newY = playerPosition.y + dy;
            const newX = playerPosition.x + dx;
    
            // Kiểm tra nếu vị trí lân cận là vùng bom
            if (map[newY]?.[newX] === MapCellChild.BombZone) {
                return true;
            }
        }
        return false
    }

    getDirectionToNeighbor(currentPos, targetPos) {
        const { x: currX, y: currY } = this.to2dPos(currentPos);
        const { x: targetX, y: targetY } = this.to2dPos(targetPos);
    
        if (currX === targetX && currY - 1 === targetY) return MoveDirectionChild.UP;    // Target ở trên
        if (currX === targetX && currY + 1 === targetY) return MoveDirectionChild.DOWN;  // Target ở dưới
        if (currX - 1 === targetX && currY === targetY) return MoveDirectionChild.LEFT;  // Target ở trái
        if (currX + 1 === targetX && currY === targetY) return MoveDirectionChild.RIGHT; // Target ở phải
    
        return null; // Không phải ô lân cận
    }
    

    async emitDriver(event, data, from) {
        await this.socket.emit(event, data);
    }

    getItem() { 
        const playerPosition = this.to2dPos(this.player.position);
        const map = this.convertFlatTo2Dmap();
        const startRow = playerPosition.y;
        const startCol = playerPosition.x;
        const radius = 5;
    
        const directions = [
            { row: 0, col: -1, move: MoveDirectionChild.LEFT },
            { row: 0, col: 1, move: MoveDirectionChild.RIGHT },
            { row: -1, col: 0, move: MoveDirectionChild.UP },
            { row: 1, col: 0, move: MoveDirectionChild.DOWN },
        ];
    
        const rows = map.length;
        const cols = map[0].length;
    
        const isValid = (row, col, visited) => {
            return (
                row >= 0 &&
                row < rows &&
                col >= 0 &&
                col < cols &&
                (map[row][col] === 0 || map[row][col] === 99) &&
                !visited[row][col]
            );
        };
    
        const queue = [{ row: startRow, col: startCol, path: "" }]; // Bắt đầu với chuỗi rỗng
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        visited[startRow][startCol] = true;
    
        while (queue.length > 0) {
            const { row, col, path } = queue.shift();
    
            // Kiểm tra nếu tìm thấy đích
            if (map[row][col] === 99) {
                return path; // Trả về chuỗi đường đi
            }
    
            // Duyệt qua các hướng
            for (const { row: dr, col: dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
    
                // Tính khoảng cách Euclidean
                const distance = Math.sqrt(Math.pow(newRow - startRow, 2) + Math.pow(newCol - startCol, 2));
                if (distance > radius) continue; // Bỏ qua nếu ngoài bán kính
    
                if (isValid(newRow, newCol, visited)) {
                    visited[newRow][newCol] = true;
                    queue.push({ row: newRow, col: newCol, path: path + move }); // Nối hướng di chuyển vào chuỗi
                }
            }
        }
    
        // Không tìm thấy đường đi
        return null;
    }

    convertFlatTo2Dmap() {
        const map = [];
        for (let i = 0; i < this.flatMap.length; i += this.mapWidth) {
            map.push(this.flatMap.slice(i, i + this.mapWidth));
        }

        return map
    }

    decideNextAction() {
        if (this.isMoving || this.isBreaking) {
            return; // Không thực hiện thêm hành động khi đang bận
        }
    
        const playerPosition = this.player.position;
    
        if (!this.hasPlacedBomb) {
            const bombPosition = this.findOptimalBombPosition(playerPosition);
            if (bombPosition) {
                this.placeBombAndRetreat(bombPosition);
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
            { dr: 0, dc: -1, move: MoveDirectionChild.LEFT },  // Trái
            { dr: 0, dc: 1, move: MoveDirectionChild.RIGHT }, // Phải
            { dr: -1, dc: 0, move: MoveDirectionChild.UP },   // Lên
            { dr: 1, dc: 0, move: MoveDirectionChild.DOWN },  // Xuống
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
            if (this.flatMap[flatIndex] === MapCellChild.Balk) {
                // console.log(`Found Balk at row=${row}, col=${col}`);
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
                        (this.flatMap[newFlatIndex] === MapCellChild.Road || this.flatMap[newFlatIndex] === MapCellChild.Balk) && // Chỉ đi qua Road hoặc Balk
                        this.flatMap[newFlatIndex] !== MapCellChild.BombZone // Tuyệt đối không đi qua BombZone
                    ) {
                        queue.push({ row: newRow, col: newCol, path: path + move });
                        visited.add(newFlatIndex); // Đánh dấu vị trí đã duyệt
                    }
                }
            }
        }
    
        // Nếu không tìm thấy đường đi
        // console.log("No valid path found.");
        return null;
    }

    // Hàm đặt bomb và di chuyển đến vị trí an toàn
    async placeBombAndRetreat(bombPosition) {
        const playerPosition = this.player.position;
        let combinedPath = "";
    
        // Bước 1: Tạo đường dẫn đến vị trí đặt bomb (1111)
        if (bombPosition) {
            combinedPath += bombPosition; // Gộp đường đi đến vị trí đặt bomb
        }
    
        // Bước 2: Thêm hành động đặt bomb (b)
        const neighbors = this.getNeighborNodes(playerPosition);
        const hasBalk = neighbors.some(({ pos }) => this.flatMap[pos] === MapCellChild.Balk);
        if (hasBalk) {
            combinedPath += "b"; // Gộp hành động đặt bomb
        }
    
        // Bước 3: Tính toán đường thoát khỏi vùng bomb nổ (3333)
        const spoilsPath = this.findEscapePath(); // Tìm đường thoát trong bán kính 5 ô
        if (spoilsPath) {
            combinedPath += spoilsPath; // Gộp đường đi thoát khỏi vùng bomb nổ
        }
    
        // Emit một lần với toàn bộ chuỗi hành động
        if (combinedPath) {
            await this.socket.emit('drive player', { direction: combinedPath, "characterType": "child" });
        }
    }
    
    

    getNeighborNodes(val) {
        const cols = this.mapWidth;

        return [
            { pos: val - cols, dir: MoveDirectionChild.UP },
            { pos: val + cols, dir: MoveDirectionChild.DOWN },
            { pos: val - 1, dir: MoveDirectionChild.LEFT },
            { pos: val + 1, dir: MoveDirectionChild.RIGHT },
        ].filter(neighbor => {
            const { pos } = neighbor;
            return pos >= 0 && pos < this.flatMap.length;
        });
    }

    async forceRandomMove() {
        const neighbors = this.getNeighborNodes(this.player.position);
    
        // Chọn ngẫu nhiên một ô lân cận có thể di chuyển
        const validNeighbors = neighbors.filter(({ pos }) => 
            this.flatMap[pos] === MapCellChild.Road || this.flatMap[pos] === MapCellChild.Spoils // Thêm MapCell.Spoils
        );
    
        if (validNeighbors.length > 0) {
            const randomNeighbor = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
            await this.emitDriver('drive player', { direction: randomNeighbor.dir, "characterType": "child"  });
        }
    }
}

export {GameMapChild };
