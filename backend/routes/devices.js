const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/', async (req, res) => {
    try {
        const [schedules] = await db.execute(
            `SELECT lt.thoi_gian_bat_dau as start_time, lt.thoi_gian_ket_thuc as end_time, lt.ma_tb_dieu_khien as ThietBiTaiBien_ID, tbdk.loai_thiet_bi as LoaiThietBi 
             FROM lich_trinh lt
             JOIN thiet_bi_dieu_khien tbdk ON lt.ma_tb_dieu_khien = tbdk.ma_thiet_bi
             ORDER BY lt.thoi_gian_bat_dau DESC`
        );
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/gateway/:thietbi_id', async (req, res) => {
    try {
        const [schedules] = await db.execute(
            `SELECT thoi_gian_bat_dau as start_time, thoi_gian_ket_thuc as end_time 
             FROM lich_trinh 
             WHERE ma_tb_dieu_khien = ? AND thoi_gian_ket_thuc >= CURTIME()`,
            [req.params.thietbi_id]
        );
        res.json({ thietbi_id: req.params.thietbi_id, schedules });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;