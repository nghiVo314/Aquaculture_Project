// Lịch sử hoạt động. Ai làm gì, lúc nào, lỗi hệ thống.
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth } = require('../middlewares/rbac');

router.get('/', requireAuth, async (req, res) => {
    try {
        const isAdmin = Array.isArray(req.user?.roles) && req.user.roles.includes('admin');
        const params = [];
        let whereClause = '';

        if (!isAdmin) {
            whereClause = 'WHERE l.ma_nguoi_dung_tao = ?';
            params.push(req.user.id);
        }

        const [rows] = await db.execute(
            `SELECT l.*, u.ten_dang_nhap as TenDangNhap
             FROM log_he_thong l
             LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
             ${whereClause}
             ORDER BY l.thoi_gian_khoi_tao DESC`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system activities (Non-warnings)
router.get('/activities', requireAuth, async (req, res) => {
    try {
        const isAdmin = Array.isArray(req.user?.roles) && req.user.roles.includes('admin');
        const params = [];
        let extraClause = '';

        if (!isAdmin) {
            extraClause = 'AND l.ma_nguoi_dung_tao = ?';
            params.push(req.user.id);
        }

        const [rows] = await db.execute(
            `SELECT l.*, u.ten_dang_nhap as TenDangNhap
             FROM log_he_thong l
             LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
             WHERE l.log_type != 'WARNING'
             ${extraClause}
             ORDER BY l.thoi_gian_khoi_tao DESC`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
