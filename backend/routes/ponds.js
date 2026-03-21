// Quản lý ao trong từng khu. List ao, thông tin chu kỳ nuôi hiện tại.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM AoNuoi_TramBien');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    const { AoNuoi_ID, KhuVuc_ID, DienTich, TramBien_ID } = req.body;
    try {
        const [result] = await db.execute('SELECT COUNT(*) as total FROM AoNuoi_TramBien WHERE KhuVuc_ID = ?', [KhuVuc_ID]);
        if (result[0].total >= 3) {
            return res.status(400).json({ status: 'error', message: 'Vùng này đã đạt tối đa 3 ao nuôi!' });
        }

        await db.execute(
            `INSERT INTO AoNuoi_TramBien (AoNuoi_ID, KhuVuc_ID, DienTich, TramBien_ID) VALUES (?, ?, ?, ?)`,
            [AoNuoi_ID, KhuVuc_ID, DienTich, TramBien_ID]
        );
        res.json({ status: 'added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET config for Gateway
router.get('/:ao_id/config', async (req, res) => {
    try {
        const [configs] = await db.execute(
            `SELECT cb.LoaiCamBien, anc.min_value, anc.max_value 
             FROM AoNuoi_CamBien anc
             JOIN CamBien cb ON anc.ThietBiTaiBien_ID = cb.ThietBiTaiBien_ID
             WHERE anc.AoNuoi_ID = ?`,
            [req.params.ao_id]
        );
        res.json({ ao_id: req.params.ao_id, configs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT config from Dashboard
router.put('/:ao_id/config', async (req, res) => {
    const { LoaiCamBien, min_value, max_value } = req.body;
    try {
        await db.execute(
            `UPDATE AoNuoi_CamBien anc
             JOIN CamBien cb ON anc.ThietBiTaiBien_ID = cb.ThietBiTaiBien_ID
             SET anc.min_value = ?, anc.max_value = ?
             WHERE anc.AoNuoi_ID = ? AND cb.LoaiCamBien = ?`,
            [min_value, max_value, req.params.ao_id, LoaiCamBien]
        );
        res.json({ status: 'success', message: `Đã cập nhật ngưỡng cho ${LoaiCamBien}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;