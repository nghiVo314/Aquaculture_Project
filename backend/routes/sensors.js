const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Receive data from gateway
router.post('/', async (req, res) => {
    const { device_id, value } = req.body; // Assuming device_id is ma_cam_bien

    try {
        await db.execute(
            `INSERT INTO du_lieu_quan_trac (ma_cam_bien, thoi_gian, gia_tri)
             VALUES (?, NOW(), ?)`,
            [device_id, value]
        );
        res.json({ status: 'saved' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.get('/latest', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT ma_du_lieu as ID, ma_cam_bien as ThietBiTaiBien_ID, thoi_gian as created_at, gia_tri as value 
             FROM du_lieu_quan_trac 
             ORDER BY thoi_gian DESC 
             LIMIT 10`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/check-offline', async (req, res) => {
    try {
        // Schema2 doesn't have LastActive, so we check the latest recorded time for each sensor
        const [offline_devices] = await db.execute(
            `SELECT ma_cam_bien 
             FROM du_lieu_quan_trac 
             GROUP BY ma_cam_bien
             HAVING MAX(thoi_gian) < NOW() - INTERVAL 5 HOUR`
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