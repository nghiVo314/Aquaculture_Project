// Lịch sử hoạt động. Ai làm gì, lúc nào, lỗi hệ thống.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Get system activities (Non-warnings)
router.get('/activities', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT l.*, u.TenDangNhap 
            FROM Log l
            LEFT JOIN User u ON l.User_ID = u.ID
            WHERE l.LogType != 'WARNING'
            ORDER BY l.CreatedAt DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;