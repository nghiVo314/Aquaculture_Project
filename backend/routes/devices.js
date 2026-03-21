// Điều khiển thiết bị trong ao (quạt, máy bơm...). Bật/tắt, đổi chế độ auto/manual.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/', async (req, res) => {
    try {
        const [schedules] = await db.execute(
            `SELECT lt.start_time, lt.end_time, lt.ThietBiTaiBien_ID, tbdk.LoaiThietBi 
             FROM LichTrinh lt
             JOIN ThietBiDieuKhien tbdk ON lt.ThietBiTaiBien_ID = tbdk.ThietBiTaiBien_ID
             ORDER BY lt.start_time DESC`
        );
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint required by the python gateway to sync schedules
router.get('/gateway/:thietbi_id', async (req, res) => {
    try {
        const [schedules] = await db.execute(
            `SELECT start_time, end_time 
             FROM LichTrinh 
             WHERE ThietBiTaiBien_ID = ? AND end_time >= NOW()`,
            [req.params.thietbi_id]
        );
        res.json({ thietbi_id: req.params.thietbi_id, schedules });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add logic for POST /schedules and DELETE /schedules similar to python code
// ...

module.exports = router;
