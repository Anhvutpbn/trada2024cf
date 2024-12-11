// Server Configuration
export const SERVER_CONFIG = {
    API_SERVER: 'http://localhost',
    GAME_ID: '2ca7b7d7-b6a8-48d2-a5ce-fa71c06510d0',
    PLAYER_ID: 'player1-xxx',
    PLAYER_ID_JOIN_GAME: 'player1-xxx',
    SOCKET_OPTIONS: {
        reconnect: true,
        transports: ['websocket'],
    },
};

// Socket Events
export const SOCKET_EVENTS = {
    JOIN_GAME: 'join game',
    REGISTER_CHARACTER_POWER: 'register character power',
    TICKTACK_PLAYER: 'ticktack player',
    DRIVE_PLAYER: 'drive player',
};

// Game Map Constants
export const MAP_CELL = {
    ROAD: 0,          // Ô trống (Người chơi có thể đi qua)
    BORDER: 1,        // Ranh giới Map (Không thể phá hủy)
    BALK: 2,          // Chướng ngại vật (Phá hủy được)
    BRICK_WALL: 3,    // Tường gạch (Vật cản)
    JAIL: 5,          // Nhà tù
    GOD_BADGE: 6,     // Huy Hiệu Thần (Đứng ở đây 3s để trở thành Bất Tử)
    SPECIAL_ZONE: 7,  // Vùng đất bị phá hủy bởi vũ khí đặc biệt
    BOMB_ZONE: "B",
    SPOILS: "A",       // Giá trị đại diện cho vật phẩm
    ENEMY: "E"
};

// Movement Directions
export const MOVE_DIRECTION = {
    LEFT: '1',  // Di chuyển sang trái
    RIGHT: '2', // Di chuyển sang phải
    UP: '3',    // Di chuyển lên trên
    DOWN: '4',  // Di chuyển xuống dưới
};

export const EVENT_GAME = {
    RUNNING: "RUNNING",
    HIT: "HIT",
    BOMBED: "BOMB",
    MARRY: "MARRY",
    NO_ACTION: "NOACTION",
    WAIT_GOD_BAGDE: "GOD",
    USE_SPECIAL_SKILL: "ICBM"
};

// Worker Tasks
export const WORKER_TASKS = {
    GAME_MAP: 'gameMap',
    GAME_MAP_CHILD: 'gameMapChild',
};

// Logging Configuration
export const LOG_LEVEL = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};
