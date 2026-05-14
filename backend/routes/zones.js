// Quản lý khu nuôi (Khu A, B, C). List tất cả khu, thông tin từng khu.
const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Đã thay authorizeRoles bằng requirePermission
const { requireAuth, requirePermission } = require('../middlewares/rbac');

// GET all regions - Yêu cầu đăng nhập
router.get('/', requireAuth, async (req, res) => {
    try {
        // 1. Lấy thông tin user đã được giải mã từ token (thông qua middleware requireAuth)
        const userId = req.user.id;
        const userRoles = req.user.roles || [];

        // 2. Kiểm tra xem người dùng có role 'admin' hay không
        const isAdmin = userRoles.includes('admin');

        // 3. Khởi tạo câu truy vấn cơ bản
        let query = `
            SELECT kv.ma_khu_vuc as ID, kv.loai_thuy_san as LoaiHaiSan, kv.ma_nguoi_dung_quan_ly,
                   nd.ten_dang_nhap as manager
            FROM khu_vuc kv
            LEFT JOIN nguoi_dung nd ON nd.ma_nguoi_dung = kv.ma_nguoi_dung_quan_ly
        `;
        let queryParams = [];

        // 4. Nếu KHÔNG phải admin, thêm điều kiện WHERE để chỉ lấy khu vực do user này quản lý
        if (!isAdmin) {
            query += ` WHERE ma_nguoi_dung_quan_ly = ?`;
            queryParams.push(userId);
        }

        // 5. Thực thi câu truy vấn
        const [rows] = await db.execute(query, queryParams);
        res.json(rows);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD region - Yêu cầu quyền 'zone:create'
router.post('/', requireAuth, requirePermission('zone:create'), async (req, res) => {
    const { ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly } = req.body; 
    
    try {
        const safeFishType = String(loai_thuy_san || '').trim();
        const safeManagerId = ma_nguoi_dung_quan_ly ? String(ma_nguoi_dung_quan_ly).trim() : null;

        if (!safeFishType) {
            return res.status(400).json({ status: 'error', message: 'Thiếu loại thủy sản' });
        }

        const [result] = await db.execute('SELECT COUNT(*) as total FROM khu_vuc');
        if (result[0].total >= 5) {
            return res.status(400).json({ status: 'error', message: 'Đã đạt giới hạn tối đa 5 vùng nuôi!' });
        }

        // Luôn tạo mã khu vực an toàn nếu không có hoặc người dùng nhập rỗng
        let finalMaKhuVuc = String(ma_khu_vuc || '').trim();
        if (!finalMaKhuVuc) {
            const [[row]] = await db.execute(`SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ma_khu_vuc, '_', -1) AS UNSIGNED)), 0) as maxid FROM khu_vuc`);
            const nextId = (row.maxid || 0) + 1;
            finalMaKhuVuc = `KV_${String(nextId).padStart(2,'0')}`;
        }

        await db.execute(
            'INSERT INTO khu_vuc (ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly) VALUES (?, ?, ?)', 
            [finalMaKhuVuc, safeFishType, safeManagerId]
        );
        res.json({ status: 'added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE region - Yêu cầu quyền 'zone:delete'
router.delete('/:id', requireAuth, requirePermission('zone:delete'), async (req, res) => {
    try {
        await db.execute('DELETE FROM khu_vuc WHERE ma_khu_vuc = ?', [req.params.id]);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE region - Yêu cầu quyền 'zone:update'
router.put('/:id', requireAuth, requirePermission('zone:update'), async (req, res) => {
    const { loai_thuy_san, ma_nguoi_dung_quan_ly } = req.body;
    try {
        const safeFishType = String(loai_thuy_san || '').trim();
        const safeManagerId = ma_nguoi_dung_quan_ly ? String(ma_nguoi_dung_quan_ly).trim() : null;

        if (!safeFishType) {
            return res.status(400).json({ status: 'error', message: 'Thiếu loại thủy sản' });
        }

        await db.execute(
            'UPDATE khu_vuc SET loai_thuy_san = ?, ma_nguoi_dung_quan_ly = ? WHERE ma_khu_vuc = ?',
            [safeFishType, safeManagerId, req.params.id]
        );
        res.json({ status: 'updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;