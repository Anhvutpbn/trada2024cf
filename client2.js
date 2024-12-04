import readline from 'readline';
import { io } from 'socket.io-client';
import { GameMap } from './machineAi.js';
// Kết nối tới server
const gameId = 'c7429f87-aaac-4119-bd4f-3600fafa0ebb';
const apiServer = 'http://192.168.1.87'; // Đổi thành URL server của bạn
const socket = io(apiServer, { reconnect: true, transports: ['websocket'] });

const playerId = 'player2-xxx'; // ID người chơi
const optionJoin = { game_id: gameId, player_id: playerId };

// Khởi tạo giao diện để nhập từ command line
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

socket.on('connect', () => {
    console.log('[Socket] Connected');
    socket.emit('join game', optionJoin);
});

socket.on('disconnect', () => {
    console.warn('[Socket] Disconnected');
});

socket.on('join game', (res) => {
    console.log('[Socket] join-game responsed:', res);
    socket.emit('register character power', {														
        "gameId": gameId,														
        "type": 1,														
    })	
});

socket.on('error', (err) => {
    console.error('[Socket] Error:', err);
});
const gameMap = new GameMap(socket, playerId);
// Sự kiện nhận ticktack từ server
socket.on('ticktack player', (res) => {
    gameMap.parseTicktack(res);
    // console.log(res.map_info.players);
    // // Đọc chuỗi lệnh từ người dùng
    // rl.question('Enter command sequence (e.g., 111222b or s): ', (input) => {
    //     const validCommands = ['1', '2', '3', '4', 'b', 's']; // Thêm 's' vào danh sách lệnh hợp lệ
    //     const commands = input.split(''); // Chia chuỗi thành mảng các ký tự

    //     const processCommand = (index) => {
    //         if (index >= commands.length) {
    //             console.log('[Command] Finished processing all commands.');
    //             return;
    //         }

    //         const command = commands[index];
    //         if (validCommands.includes(command)) {
    //             if (command === 's') {
    //                 // Gửi lệnh "switch weapon"
    //                 socket.emit('action', {
    //                     action: "switch weapon",
    //                 });
    //                 console.log(`[Command] Sent action: switch weapon`);
    //             } else {
    //                 // Gửi lệnh lái player
    //                 socket.emit('drive player', { direction: command });
    //                 console.log(`[Command] Sent direction: ${command}`);
    //             }

    //             // Chờ 500ms trước khi gửi lệnh tiếp theo (tùy chỉnh thời gian chờ nếu cần)
    //             setTimeout(() => processCommand(index + 1), 500);
    //         } else {
    //             console.log(`[Command] Invalid input: ${command}. Skipping...`);
    //             processCommand(index + 1);
    //         }
    //     };

    //     // Bắt đầu xử lý chuỗi lệnh
    //     processCommand(0);
    // });
});

// Đóng readline khi kết thúc
socket.on('end', () => {
    rl.close();
});
