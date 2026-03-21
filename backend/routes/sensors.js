const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Receive data from gateway
router.post('/', async (req, res) => {
    const { id, device_id, value } = req.body;

    try {
        await db.execute(
            `INSERT INTO DuLieuQuanTrac (ID, ThietBiTaiBien_ID, created_at, value)
             VALUES (?, ?, NOW(), ?)`,
            [id, device_id, value]
        );
        res.json({ status: 'saved' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.get('/latest', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT ID, ThietBiTaiBien_ID, created_at, value 
             FROM DuLieuQuanTrac 
             ORDER BY created_at DESC 
             LIMIT 10`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/check-offline', async (req, res) => {
    try {
        const [offline_devices] = await db.execute(
            `SELECT ID, TramBien_ID, LastActive 
             FROM ThietBiTaiBien 
             WHERE LastActive < NOW() - INTERVAL 5 HOUR`
        );

        if (offline_devices.length > 0) {
            return res.json({ status: 'warning', offline_devices });
        }
        res.json({ status: 'ok', message: 'Tất cả thiết bị đều hoạt động bình thường.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;