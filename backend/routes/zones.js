// Quản lý khu nuôi (Khu A, B, C). List tất cả khu, thông tin từng khu.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// GET all regions
router.get('/', async (req, res) => {
    try {
        // Alias columns to maintain compatibility with your frontend if needed,
        // while also pulling the new ma_nguoi_dung_quan_ly field
        const [rows] = await db.execute(`
            SELECT ma_khu_vuc as ID, loai_thuy_san as LoaiHaiSan, ma_nguoi_dung_quan_ly 
            FROM khu_vuc
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD region
router.post('/', async (req, res) => {
    // Note: Schema2 uses ma_khu_vuc (VARCHAR) instead of auto-increment ID
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

// DELETE region
router.delete('/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM khu_vuc WHERE ma_khu_vuc = ?', [req.params.id]);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE region
router.put('/:id', async (req, res) => {
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