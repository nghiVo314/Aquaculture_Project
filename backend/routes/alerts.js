// Cảnh báo khi thông số bất thường (DO thấp, pH lệch...). Xem + xác nhận alert.
const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Đã thay authorizeRoles bằng requirePermission
const { requireAuth, requirePermission } = require('../middlewares/rbac');

// Get Warnings (Alerts) - Yêu cầu đăng nhập
router.get('/', requireAuth, async (req, res) => {
    const statusFilter = req.query.status;
    const pondId = req.query.pond_id;
    let query = `
        SELECT l.*, u.ten_dang_nhap as TenDangNhap 
        FROM log_he_thong l
        LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
        WHERE l.log_type = 'WARNING'
    `;
    const params = [];
    
    if (statusFilter === 'unacknowledged') {
        query += ' AND l.acknowledged = 0';
    }
    if (pondId) {
        query += ' AND l.mo_ta LIKE ?';
        params.push(`%[POND:${pondId}]%`);
    }
    query += ' ORDER BY l.thoi_gian_khoi_tao DESC';

    try {
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Acknowledge a warning - Yêu cầu quyền 'alerts:ack'
router.put('/:log_id/ack', requireAuth, requirePermission('alerts:ack'), async (req, res) => {
    // Lấy ID/Username trực tiếp từ token để bảo mật, thay vì lấy từ body
    const username = req.user.username; 
    try {
        await db.execute(
            `UPDATE log_he_thong 
             SET acknowledged = 1, mo_ta = CONCAT(mo_ta, ' (Đã xử lý bởi User: ', ?, ')')
             WHERE ma_log = ?`,
            [username, req.params.log_id]
        );
        res.json({ status: 'success', message: 'Đã đánh dấu xử lý!' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
});

module.exports = router;