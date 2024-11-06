// server.js
const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server);

// Event khi có kết nối mới từ client
io.on('connection', (socket) => {
    console.log('A client connected');

    // Event khi nhận được tin nhắn từ client
    socket.on('clientMessage', (data) => {
        console.log('Received message from client:', data);

        // Gửi tin nhắn đến client
        socket.emit('serverMessage', 'Hello, client!');
    });

    // Event khi kết nối bị đóng
    socket.on('disconnect', () => {
        console.log('A client disconnected');
    });
});

const port = 3000; // Thay đổi cổng nếu cần
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
