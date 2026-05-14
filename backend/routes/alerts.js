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
    const sort = String(req.query.sort || 'newest').toLowerCase();
    const days = Number.parseInt(req.query.days || '', 10); // 🆕 Thêm filter ngày
    const cutoffDate = Number.isFinite(days) && days > 0
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null;
    
    let query = `
        SELECT l.ma_log, l.ma_nguoi_dung_tao, l.log_type, l.source_type, l.acknowledged, 
               l.mo_ta, l.thoi_gian_khoi_tao, u.ten_dang_nhap as TenDangNhap,
               a.ma_ao_nuoi, a.ma_khu_vuc,
               worker.ma_nguoi_dung as worker_id, worker.ten_dang_nhap as worker_name
        FROM log_he_thong l
        LEFT JOIN nguoi_dung u ON l.ma_nguoi_dung_tao = u.ma_nguoi_dung
        LEFT JOIN ao_nuoi a ON l.mo_ta LIKE CONCAT('%[POND:', a.ma_ao_nuoi, ']%')
        LEFT JOIN nguoi_dung worker ON worker.ma_nguoi_dung = a.ma_nguoi_dung_phu_trach
        JOIN (
            SELECT 
                MAX(ma_log) AS ma_log
            FROM log_he_thong
            WHERE log_type = 'WARNING'
              AND LOWER(mo_ta) NOT LIKE '%type:offline%'
              AND LOWER(mo_ta) NOT LIKE '%chưa có dữ liệu%'
            GROUP BY COALESCE(
                SUBSTRING_INDEX(SUBSTRING_INDEX(mo_ta, '[POND:', -1), ']', 1),
                ''
            ), COALESCE(
                SUBSTRING_INDEX(SUBSTRING_INDEX(mo_ta, '[SENSOR:', -1), ']', 1),
                ''
            ), COALESCE(
                SUBSTRING_INDEX(SUBSTRING_INDEX(mo_ta, '[TYPE:', -1), ']', 1),
                ''
            ), COALESCE(acknowledged, 0), COALESCE(mo_ta, '')
        ) latest ON latest.ma_log = l.ma_log
        WHERE l.log_type = 'WARNING'
          AND LOWER(l.mo_ta) NOT LIKE '%type:offline%'
          AND LOWER(l.mo_ta) NOT LIKE '%chưa có dữ liệu%'
    `;
    const params = [];
    
    // 🆕 THÊM FILTER NGÀY
    if (cutoffDate) {
        query += ' AND l.thoi_gian_khoi_tao >= ?';
        params.push(cutoffDate);
    }
    
    if (statusFilter === 'unacknowledged') {
        query += ' AND l.acknowledged = 0';
    }
    if (pondId) {
        query += ' AND l.mo_ta LIKE ?';
        params.push(`%[POND:${pondId}]%`);
    }

    const priorityOrder = `
        CASE
            WHEN LOWER(l.mo_ta) LIKE '%[severity:critical]%' THEN 3
            WHEN LOWER(l.mo_ta) LIKE '%[severity:warning]%' THEN 2
            WHEN LOWER(l.mo_ta) LIKE '%[severity:caution]%' THEN 1
            ELSE 0
        END
    `;

    if (sort === 'urgent') {
        query += ` ORDER BY ${priorityOrder} DESC, l.acknowledged ASC, l.thoi_gian_khoi_tao DESC`;
    } else {
        query += ' ORDER BY l.thoi_gian_khoi_tao DESC';
    }

    try {
        // Debug: log query and params to help track down incorrect argument errors
        const placeholderCount = (query.match(/\?/g) || []).length;
        console.log('[alerts] executing query', { placeholderCount, paramsLength: params.length, query, params });
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('[alerts] query failed', error);
        res.status(500).json({ error: error.message, query, params });
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
