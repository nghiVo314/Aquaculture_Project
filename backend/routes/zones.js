// Quản lý khu nuôi (Khu A, B, C). List tất cả khu, thông tin từng khu.
const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Đã thay authorizeRoles bằng requirePermission
const { requireAuth, requirePermission } = require('../middlewares/rbac');
// GET all regions - Yêu cầu đăng nhập
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT ma_khu_vuc as ID, loai_thuy_san as LoaiHaiSan, ma_nguoi_dung_quan_ly 
            FROM khu_vuc
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD region - Yêu cầu quyền 'zone:create'
router.post('/', requireAuth, requirePermission('zone:create'), async (req, res) => {
    const { ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly } = req.body; 
    
    try {
        const [result] = await db.execute('SELECT COUNT(*) as total FROM khu_vuc');
        if (result[0].total >= 5) {
            return res.status(400).json({ status: 'error', message: 'Đã đạt giới hạn tối đa 5 vùng nuôi!' });
        }

        await db.execute(
            'INSERT INTO khu_vuc (ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly) VALUES (?, ?, ?)', 
            [ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly || null]
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
        await db.execute(
            'UPDATE khu_vuc SET loai_thuy_san = ?, ma_nguoi_dung_quan_ly = ? WHERE ma_khu_vuc = ?',
            [loai_thuy_san, ma_nguoi_dung_quan_ly || null, req.params.id]
        );
        res.json({ status: 'updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;