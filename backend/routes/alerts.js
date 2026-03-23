// Cảnh báo khi thông số bất thường (DO thấp, pH lệch...). Xem + xác nhận alert.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Get Warnings (Alerts)
router.get('/', async (req, res) => {
    const statusFilter = req.query.status;
    let query = `
        SELECT l.*, u.ten_dang_nhap as TenDangNhap 
        FROM log_he_thong l
        LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
        WHERE l.log_type = 'WARNING'
    `;
    
    if (statusFilter === 'unacknowledged') {
        query += ' AND l.acknowledged = 0';
    }
    query += ' ORDER BY l.thoi_gian_khoi_tao DESC';

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
            `UPDATE log_he_thong 
             SET acknowledged = 1, mo_ta = CONCAT(mo_ta, ' (Đã xử lý bởi User ID: ', ?, ')')
             WHERE ma_log = ?`,
            [User_ID, req.params.log_id]
        );
        res.json({ status: 'success', message: 'Đã đánh dấu xử lý!' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
});

module.exports = router;