// Dashboard chung: Thống kê tổng quan về khu nuôi, ao, thiết bị, cảnh báo... Cho phép điều hướng đến các phần chi tiết hơn (zones, ponds, devices, alerts).
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/summary', async (req, res) => {
    try {
        // Run all simple count queries concurrently for better performance
        const [
            [khuvucResult],
            [vunuoiResult],
            [aonuoiResult],
            [logsResult],
            [areaResult]
        ] = await Promise.all([
            db.execute('SELECT COUNT(*) as total_khuvuc FROM KhuVuc'),
            db.execute('SELECT COUNT(*) as total_vunuoi FROM VuNuoi'),
            db.execute('SELECT COUNT(*) as total_aonuoi FROM AoNuoi_TramBien'),
            db.execute('SELECT COUNT(*) as unhandled_logs FROM Log WHERE Acknowledged = 0'),
            db.execute('SELECT SUM(DienTich) as total_area FROM AoNuoi_TramBien')
        ]);

        // Fetch detailed zone information
        const [zoneDetails] = await db.execute(`
            SELECT 
                kv.ID as KhuVuc_ID, 
                kv.LoaiHaiSan,
                COUNT(DISTINCT antb.AoNuoi_ID) as so_ao,
                SUM(antb.DienTich) as tong_dien_tich
            FROM KhuVuc kv
            LEFT JOIN AoNuoi_TramBien antb ON kv.ID = antb.KhuVuc_ID
            GROUP BY kv.ID, kv.LoaiHaiSan
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