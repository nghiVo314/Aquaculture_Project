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
        const offlineMinutes = Number(req.query.minutes || process.env.SENSOR_OFFLINE_MINUTES || 10);
        const [offline_devices] = await db.execute(
            `SELECT
                cb.ma_thiet_bi AS ma_cam_bien,
                cb.loai_cam_bien,
                an.ma_ao_nuoi AS ma_ao_nuoi,
                MAX(dl.thoi_gian) AS lan_cuoi
             FROM cam_bien cb
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             JOIN ao_nuoi an ON tb.ma_ao_nuoi = an.ma_ao_nuoi
             LEFT JOIN du_lieu_quan_trac dl ON dl.ma_cam_bien = cb.ma_thiet_bi
             GROUP BY cb.ma_thiet_bi, cb.loai_cam_bien, an.ma_ao_nuoi
             HAVING lan_cuoi IS NULL OR lan_cuoi < NOW() - INTERVAL ? MINUTE`,
            [offlineMinutes]
        );

        if (offline_devices.length > 0) {
            return res.json({ status: 'warning', offline_devices, offlineMinutes });
        }
        res.json({ status: 'ok', message: 'Tất cả thiết bị đều hoạt động bình thường.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm vào backend/routes/sensors.js
router.get('/:device_id/history', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT thoi_gian, gia_tri 
             FROM du_lieu_quan_trac 
             WHERE ma_cam_bien = ? 
             ORDER BY thoi_gian DESC 
             LIMIT 20`,
            [req.params.device_id]
        );
        // Đảo ngược mảng để hiển thị từ cũ đến mới trên biểu đồ
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;