// Quản lý khu nuôi (Khu A, B, C). List tất cả khu, thông tin từng khu.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// GET all regions
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM KhuVuc');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD region
router.post('/', async (req, res) => {
    const { LoaiHaiSan } = req.body;
    try {
        const [result] = await db.execute('SELECT COUNT(*) as total FROM KhuVuc');
        if (result[0].total >= 5) {
            return res.status(400).json({ status: 'error', message: 'Đã đạt giới hạn tối đa 5 vùng nuôi!' });
        }

        await db.execute('INSERT INTO KhuVuc (LoaiHaiSan) VALUES (?)', [LoaiHaiSan]);
        res.json({ status: 'added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE region
router.delete('/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM KhuVuc WHERE ID = ?', [req.params.id]);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE region
router.put('/:id', async (req, res) => {
    const { LoaiHaiSan } = req.body;
    try {
        await db.execute('UPDATE KhuVuc SET LoaiHaiSan = ? WHERE ID = ?', [LoaiHaiSan, req.params.id]);
        res.json({ status: 'updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
