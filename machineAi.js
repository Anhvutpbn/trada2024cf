import { MAP_CELL, MOVE_DIRECTION, EVENT_GAME } from './config.js';
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
        this.position = gameMap.playerPosition(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
        this.playerInfo = playerInfo;
    }

    setPlayerInfo(playerInfo) {
        this.playerInfo = playerInfo
    }

    setPosition(gameMap, playerInfo) {
        this.position = gameMap.playerPosition(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
    }
}

class GameMap {
    constructor(playerId) {
        this.playerId = playerId;
        this.playerIdChill = playerId+"_child";
        this.map = [];
        this.flatMap = [];
        this.mapWidth = 45;
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

         this.marry = false
         
         // Tao them 1 bien luu gia tri bomb cu
         this.oldBomb = {}
    }

    async parseTicktack(res) {
        this.mapWidth = res.map_info.size.cols;
        this.mapHeight = res.map_info.size.rows;
        this.spoils = res.map_info.spoils;
        this.map = res.map_info.map;

        const currentPlayer = res.map_info.players.find(p => this.playerId.includes(p.id));
        if(!currentPlayer || currentPlayer == undefined) {
            console.log(null)
            return null
        }

        const enemies = res.map_info.players.filter(
            p => p.id !== this.playerId && p.id !== this.playerIdChill
        );
          
        if (enemies.length > 0) {
            enemies.forEach(enemy => {
                if (enemy !== undefined && enemy.currentPosition !== undefined && enemy.currentPosition.col !== undefined) {
                    this.map[enemy.currentPosition.row][enemy.currentPosition.col] = MAP_CELL.ENEMY;
                }
            });
        }
        
        // this.printMap2DV2(this.map)

        if(this.player) {
            this.player.setPlayerInfo(currentPlayer)
            this.player.setPosition(this, currentPlayer)
        } else {
            this.player = new GamePlayer(this, currentPlayer);
        }
        if(!this.player.playerInfo.hasTransform) {
            
            // kiem tra theo tag
            if(res.tag == STOP_MOVING && res.player_id == this.playerId) {
                if(this.hasValueThree(currentPlayer.currentPosition.row, currentPlayer.currentPosition.col) ) {
                    this.isMoving = false
                    return {type: EVENT_GAME.RUNNING, path: "b"}
                }
            }
             const findPathStoppingAtThree = this.findPathStoppingAtThree(this.map, [currentPlayer.currentPosition.row, currentPlayer.currentPosition.col])
            if(findPathStoppingAtThree.type == 1 || !this.isMoving) {
                this.isMoving = true
                return {type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path}
            }
            if(findPathStoppingAtThree.type == 2 || !this.isMoving) {
                this.isMoving = true
                return {type: EVENT_GAME.RUNNING, path: findPathStoppingAtThree.path}
            }
            if(findPathStoppingAtThree.type == 3 || !this.isMoving) {
                this.isMoving = true
                return {type: EVENT_GAME.NO_ACTION, path: null}
            }
        }

        if(!this.marry && this.player.playerInfo.eternalBadge > 0) {
            this.marry = true						
            return 
        }

        return "VUTA"
    }

    playerPosition(x, y) { return { row: x, col: y} }
    printMap2DV2(map) {
        console.log("Current Map:");
        for (let y = 0; y < map.length; y++) { // Duyệt từng hàng
            let row = map[y].join(' '); // Ghép các phần tử của hàng với khoảng trắng
            console.log(row); // In ra hàng đã tạo
        }
    }

    // Tìm đường đi đến ô 6 gần nhất
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
            (grid[x][y] === 0 || grid[x][y] === 3 || grid[x][y] === 6) // Chỉ đi qua 0, 3 và 6
          );
        };
      
        const queue = [[start[0], start[1], []]]; // [x, y, path[]]
        const visited = Array.from({ length: grid.length }, () =>
          Array(grid[0].length).fill(false)
        );
        visited[start[0]][start[1]] = true;
      
        while (queue.length > 0) {
          const [x, y, path] = queue.shift();
      
          // Nếu gặp ô 6, trả về toàn bộ đường đi đã lưu
          if (grid[x][y] === 6) {
            const fullPath = [...path, { move: null, value: 6 }];
            // Tìm đường đi đến ô 3 gần nhất
            const stoppingPath = [];
            for (const step of fullPath) {
              if (step.value === 3) {
                // TYPE = =1 la co hop
                return {type: 1, path: stoppingPath.filter(Boolean).join('')};
              }
              stoppingPath.push(step.move);
            }
            // Nếu không gặp ô 3, trả về toàn bộ đường đi
            // TYPE = 2 la di thang den GOD BADGE
            return {type: 2, path: stoppingPath.filter(Boolean).join('')};
          }
      
          // Duyệt các hướng
          for (const [dx, dy, action] of directions) {
            const nx = x + dx;
            const ny = y + dy;
      
            if (isValid(nx, ny, visited)) {
              queue.push([
                nx,
                ny,
                [...path, { move: action, value: grid[x][y], row: x, col: y}],
              ]);
              visited[nx][ny] = true;
            }
          }
        }
      
        // Không tìm được đường đi
        // TYPE = 3 khong co duong di
        return {type: 3, path: null};
      };

      // Neu xung quanh co BRICK_WALL thi reutrn true. Để phá
      hasValueThree(x, y) {
        if(
            this.map[x + 1][y] == MAP_CELL.BRICK_WALL ||
            this.map[x - 1][y] == MAP_CELL.BRICK_WALL || 
            this.map[x][y+1] == MAP_CELL.BRICK_WALL ||
            this.map[x][y-1] == MAP_CELL.BRICK_WALL
        ) {
            return true
        }
        return false; // Không có giá trị bằng 3 ở bất kỳ hướng nào
    }
    
}

export { GameMap };
