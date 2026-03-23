const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/summary', async (req, res) => {
    try {
        const [
            [khuvucResult],
            [vunuoiResult],
            [aonuoiResult],
            [logsResult],
            [areaResult]
        ] = await Promise.all([
            db.execute('SELECT COUNT(*) as total_khuvuc FROM khu_vuc'),
            db.execute('SELECT COUNT(*) as total_vunuoi FROM vu_nuoi'),
            db.execute('SELECT COUNT(*) as total_aonuoi FROM ao_nuoi'),
            db.execute('SELECT COUNT(*) as unhandled_logs FROM log_he_thong WHERE acknowledged = 0'),
            db.execute('SELECT SUM(dien_tich) as total_area FROM ao_nuoi')
        ]);

        const [zoneDetails] = await db.execute(`
            SELECT 
                kv.ma_khu_vuc as KhuVuc_ID, 
                kv.loai_thuy_san as LoaiHaiSan,
                COUNT(DISTINCT an.ma_ao_nuoi) as so_ao,
                SUM(an.dien_tich) as tong_dien_tich
            FROM khu_vuc kv
            LEFT JOIN ao_nuoi an ON kv.ma_khu_vuc = an.ma_khu_vuc
            GROUP BY kv.ma_khu_vuc, kv.loai_thuy_san
        `);

        res.json({
            cards: {
                khuvuc: khuvucResult[0].total_khuvuc,
                vunuoi: vunuoiResult[0].total_vunuoi,
                aonuoi: aonuoiResult[0].total_aonuoi,
                unhandled_logs: logsResult[0].unhandled_logs,
                total_area: areaResult[0].total_area || 0
            },
            zones: zoneDetails
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;