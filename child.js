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
        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        this.caculatorResetTime++
        // console.log("this.caculatorResetTime....", this.caculatorResetTime)

        this.map = res.map_info.map;

        const enemies = res.map_info.players.filter(
            p => p.id !== this.playerId && p.id !== this.playerFather
          );
          
        if (enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy !== undefined && enemy.currentPosition !== undefined && enemy.currentPosition.col !== undefined) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MapCell.Balk;
                }
            });
        }
        
        const nonChildEnemies = enemies.filter(enemy => !enemy.id.endsWith('_child'));
        nonChildEnemies.forEach(enemy => {
            if (!enemy.hasTransform) {
                if (enemy.currentPosition.col !== undefined) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MapCell.Border;
                }
            }
        });

        this.replaceValuesInRadius(
            currentPlayer.currentPosition.row, 
            currentPlayer.currentPosition.col,
            10, 
            MapCell.SpecialZone, 
            MapCell.Road
        )
        // check vij trí búa
        
        if(res.map_info.weaponHammers.length > 0) {
            this.updateMapWithICBM(res.map_info.weaponHammers, MapCell.BombZone)
        }
        
        this.flatMap = this.map.flat();
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        this.spoils = res.map_info.spoils;
        
        if(this.player) {
            this.player.setPlayerInfo(currentPlayer)
            this.player.setPosition(this, currentPlayer)
        } else {
            this.player = new GamePlayer(this, currentPlayer);
        }
        
        this.bombsPosition = []
        const hasTransform = this.player.playerInfo.hasTransform;
        this.bombs = res.map_info.bombs.filter(bomb => bomb.playerId === this.player.playerInfo.id);
    
        // Lặp qua tất cả các bomb trên bản đồ và tính toán vùng ảnh hưởng
        for (const bomb of res.map_info.bombs) {
            const bombPosition = this.to1dPos(bomb.col, bomb.row);
            this.replaceBombImpactWithSpecialZone(bombPosition, bomb.power); // Đảm bảo chờ tác vụ bất đồng bộ
        }
        
        
        if(this.flatMap[this.player.position] == MapCell.BombZone) {
            this.awayFromBom = true
            const spoilsPath = this.findEscapePath(); // Tìm đường thoát trong bán kính 5 ô
            await this.socket.emit('drive player', { direction: spoilsPath });
            return
        }

        if (hasTransform === undefined) {
            console.warn("Transform state is undefined. Skipping action.");
            return;
        }
        
        this.replaceSpoilsToMapValue()
        // Kiểm tra trạng thái đứng yên
        this.checkIdleStatus();

        if (enemies.length > 0 && this.parentSkill) {
            for (const enemy of enemies) {
                // console.log(enemy);
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
            await this.emitDriver('drive player', { direction: 'x' });
        }
        // Picking Item TODO
        if (this.bombs.length == 0  && hasTransform && !this.isWaitingAtGodBadge) {
            const spoilsPath = this.getItem(); // Tìm Spoils trong bán kính 5 ô
                if (spoilsPath) {
                    this.socket.emit('drive player', { direction: spoilsPath });
                } else {
                    // return this.decideNextAction(hasTransform);
                }
            // return;
        }
        const map2 = this.convertFlatTo2Dmap();
        this.print2DArray(map2)
        // Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường
        // console.log("Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường", this.hasPlacedBomb)     
        return this.decideNextAction(hasTransform);
    }
    
}

export {GameMapChild };
