const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Thêm requireAuth để lấy được thông tin req.user từ token
const { requireAuth } = require('../middlewares/rbac');

router.get('/summary', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.roles?.includes('admin');

        // 1. Chuẩn bị các chuỗi điều kiện WHERE động
        let whereKhuVuc = '';
        let whereAoNuoi = '';
        let whereVuNuoi = '';
        let queryParams = [];

        if (!isAdmin) {
            whereKhuVuc = 'WHERE ma_nguoi_dung_quan_ly = ?';
            whereAoNuoi = 'WHERE ma_khu_vuc IN (SELECT ma_khu_vuc FROM khu_vuc WHERE ma_nguoi_dung_quan_ly = ?)';
            whereVuNuoi = 'WHERE ma_ao_nuoi IN (SELECT ma_ao_nuoi FROM ao_nuoi WHERE ma_khu_vuc IN (SELECT ma_khu_vuc FROM khu_vuc WHERE ma_nguoi_dung_quan_ly = ?))';
            
            queryParams = [userId]; 
        }

        // ==========================================
        // PHẦN 1: TÍNH TOÁN CÁC CHỈ SỐ KPI (CARDS)
        // ==========================================
        const [
            [khuvucResult],
            [vunuoiResult],
            [aonuoiResult],
            [logsResult],
            [areaResult]
        ] = await Promise.all([
            db.execute(`SELECT COUNT(*) as total_khuvuc FROM khu_vuc`),
            db.execute(`SELECT COUNT(*) as total_vunuoi FROM vu_nuoi`),
            db.execute(`SELECT COUNT(*) as total_aonuoi FROM ao_nuoi`),
            db.execute(`SELECT COUNT(*) as unhandled_logs FROM log_he_thong WHERE acknowledged = 0`),
            db.execute(`SELECT SUM(dien_tich) as total_area FROM ao_nuoi`)
        ]);

        // ==========================================
        // PHẦN 2: LẤY DỮ LIỆU PHÂN CẤP (ZONES -> PONDS -> DEVICES)
        // ==========================================

        // BƯỚC 2.1: Lấy danh sách Khu Vực
        let zoneQuery = `
            SELECT 
                kv.ma_khu_vuc as KhuVuc_ID, 
                kv.loai_thuy_san as LoaiHaiSan,
                COUNT(DISTINCT an.ma_ao_nuoi) as so_ao,
                SUM(an.dien_tich) as tong_dien_tich
            FROM khu_vuc kv
            LEFT JOIN ao_nuoi an ON kv.ma_khu_vuc = an.ma_khu_vuc
        `;
        if (!isAdmin) {
            zoneQuery += ` WHERE kv.ma_nguoi_dung_quan_ly = ?`;
        }
        zoneQuery += ` GROUP BY kv.ma_khu_vuc, kv.loai_thuy_san`;
        const [zonesData] = await db.execute(zoneQuery, queryParams);

        const [globalZonesData] = await db.execute(`
            SELECT 
                kv.ma_khu_vuc as KhuVuc_ID, 
                kv.loai_thuy_san as LoaiHaiSan,
                COUNT(DISTINCT an.ma_ao_nuoi) as so_ao,
                SUM(an.dien_tich) as tong_dien_tich
            FROM khu_vuc kv
            LEFT JOIN ao_nuoi an ON kv.ma_khu_vuc = an.ma_khu_vuc
            GROUP BY kv.ma_khu_vuc, kv.loai_thuy_san
        `);

        // BƯỚC 2.2: Lấy danh sách Ao Nuôi
        let pondQuery = `SELECT ma_ao_nuoi as AoNuoi_ID, ma_khu_vuc as KhuVuc_ID, dien_tich FROM ao_nuoi ${whereAoNuoi}`;
        const [pondsData] = await db.execute(pondQuery, queryParams);

        // BƯỚC 2.3: Lấy danh sách Thiết bị (Ở đây ta tạm dùng trạm biển đại diện cho thiết bị trong ao)
        // Đổi trạng thái 'CONNECTED' thành 'ON' để Frontend hiển thị màu Xanh, ngược lại là Đỏ (OFF)
        let deviceQuery = `
            SELECT 
                ma_tram as ma_thiet_bi, 
                'Trạm quan trắc' as ten_thiet_bi, 
                IF(trang_thai_cloud = 'CONNECTED', 'ON', 'OFF') as trang_thai, 
                ma_ao_nuoi as AoNuoi_ID 
            FROM tram_bien
        `;
        const [devicesData] = await db.execute(deviceQuery);

        // ==========================================
        // PHẦN 3: LỒNG GHÉP DỮ LIỆU (NESTING)
        // ==========================================

        // 3.1 Nhét thiết bị vào từng ao tương ứng
        const pondsWithDevices = pondsData.map(pond => {
            return {
                ...pond,
                thiet_bi: devicesData.filter(device => device.AoNuoi_ID === pond.AoNuoi_ID)
            };
        });

        // 3.2 Nhét các ao (đã có thiết bị) vào khu vực tương ứng
        const nestedZones = zonesData.map(zone => {
            return {
                ...zone,
                danh_sach_ao: pondsWithDevices.filter(pond => pond.KhuVuc_ID === zone.KhuVuc_ID)
            };
        });

        // ==========================================
        // PHẦN 4: TRẢ VỀ JSON CHO FRONTEND
        // ==========================================
        res.json({
            cards: {
                khuvuc: khuvucResult[0].total_khuvuc,
                vunuoi: vunuoiResult[0].total_vunuoi,
                aonuoi: aonuoiResult[0].total_aonuoi,
                unhandled_logs: logsResult[0].unhandled_logs,
                total_area: areaResult[0].total_area || 0
            },
            zones: nestedZones,
            globalZones: globalZonesData // Dữ liệu tổng hợp cho tất cả người dùng (dành cho admin) để vẽ biểu đồ phân tích theo khu vực
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;