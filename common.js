class CommonFunction {
    // Tính khoảng cách Manhattan giữa hai người chơi
    calculateManhattanDistance(player1, player2) {
        return Math.abs(player1.row - player2.row) + Math.abs(player1.col - player2.col);
    }

    // Lưu tất cả các vị trí trong bán kính vào mảng
    getAffectedArea(map, center, radius) {
        const affectedArea = [];
        for (let row = 0; row < map.length; row++) {
            for (let col = 0; col < map[0].length; col++) {
                const distance = this.calculateManhattanDistance(center, { row, col });
                if (distance <= 7) {
                    affectedArea.push({ row, col });
                }
            }
        }

        return affectedArea;
    }

    // Tìm đường thoát khỏi vùng ảnh hưởng
    findPathOutOfAffectedArea(map, player2, affectedArea) {
        const directions = [
            { dr: 0, dc: -1, move: '1' }, // Trái
            { dr: 0, dc: 1, move: '2' },  // Phải
            { dr: -1, dc: 0, move: '3' }, // Lên
            { dr: 1, dc: 0, move: '4' },  // Xuống
        ];

        const MAP_CELL = {
            ROAD: 0,
        };

        const queue = [{ row: player2.row, col: player2.col, path: '' }];
        const visited = Array.from({ length: map.length }, () =>
            Array(map[0].length).fill(false)
        );
        visited[player2.row][player2.col] = true;

        const isInAffectedArea = (row, col) => {
            return affectedArea.some(pos => pos.row === row && pos.col === col);
        };

        while (queue.length > 0) {
            const { row, col, path } = queue.shift();

            // Nếu đã thoát khỏi vùng ảnh hưởng, trả về đường đi
            if (!isInAffectedArea(row, col)) {
                return { needMove: true, path };
            }

            for (const { dr, dc, move } of directions) {
                const newRow = row + dr;
                const newCol = col + dc;

                // Kiểm tra vị trí mới hợp lệ
                if (
                    newRow >= 0 &&
                    newRow < map.length &&
                    newCol >= 0 &&
                    newCol < map[0].length &&
                    map[newRow][newCol] === MAP_CELL.ROAD && // Chỉ di chuyển đến ô trống
                    !visited[newRow][newCol]
                ) {
                    queue.push({ row: newRow, col: newCol, path: path + move });
                    visited[newRow][newCol] = true;
                }
            }
        }

        // Không tìm được đường thoát, giữ nguyên vị trí
        return { needMove: false, path: '' };
    }

    // Hàm nguồn: Xử lý logic tổng thể
    processEscape(map, player1, player2, radius) {
        if(this.calculateManhattanDistance(player1, player2) > 5) {
            return { needMove: false, path: '' };
        }
        // Lấy tất cả các vị trí trong bán kính
        const affectedArea = this.getAffectedArea(map, player1, radius);

        // Tìm đường thoát cho player2
        const result = this.findPathOutOfAffectedArea(map, player2, affectedArea);

        return result;
    }


    // Kiểm tra không còn bomb trên bản đồ của bản thân
    isPlayerIdNotInArray(array, playerId) {
        return !array.some(item => item.playerId === playerId);
      }
}

export { CommonFunction };
