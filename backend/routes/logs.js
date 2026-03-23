// Lịch sử hoạt động. Ai làm gì, lúc nào, lỗi hệ thống.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Get system activities (Non-warnings)
router.get('/activities', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT l.*, u.ten_dang_nhap as TenDangNhap 
            FROM log_he_thong l
            LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
            WHERE l.log_type != 'WARNING'
            ORDER BY l.thoi_gian_khoi_tao DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;