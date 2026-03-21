// Cảnh báo khi thông số bất thường (DO thấp, pH lệch...). Xem + xác nhận alert.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Get Warnings (Alerts)
router.get('/', async (req, res) => {
    const statusFilter = req.query.status;
    let query = `
        SELECT l.*, u.TenDangNhap 
        FROM Log l
        LEFT JOIN User u ON l.User_ID = u.ID
        WHERE l.LogType = 'WARNING'
    `;
    
    if (statusFilter === 'unacknowledged') {
        query += ' AND l.Acknowledged = 0';
    }
    query += ' ORDER BY l.CreatedAt DESC';

    try {
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Acknowledge a warning
router.put('/:log_id/ack', async (req, res) => {
    const { User_ID } = req.body;
    try {
        await db.execute(
            `UPDATE Log 
             SET Acknowledged = 1, MoTa = CONCAT(MoTa, ' (Đã xử lý bởi User ID: ', ?, ')')
             WHERE ID = ?`,
            [User_ID, req.params.log_id]
        );
        res.json({ status: 'success', message: 'Đã đánh dấu xử lý!' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
