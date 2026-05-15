const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth } = require('../middlewares/rbac');

function toNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

router.get('/summary', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.roles?.includes('admin');

        const queryParams = !isAdmin ? [userId] : [];
        const zoneFilter = !isAdmin ? 'WHERE kv.ma_nguoi_dung_quan_ly = ?' : '';
        const pondFilter = !isAdmin
            ? 'WHERE an.ma_khu_vuc IN (SELECT ma_khu_vuc FROM khu_vuc WHERE ma_nguoi_dung_quan_ly = ?)'
            : '';
        const deviceJoinFilter = !isAdmin ? 'JOIN khu_vuc kv_filter ON kv_filter.ma_khu_vuc = an.ma_khu_vuc' : '';
        const deviceWhereClause = !isAdmin ? 'WHERE kv_filter.ma_nguoi_dung_quan_ly = ?' : '';
        const deviceParams = !isAdmin ? [userId] : [];

        const [
            [logsResult],
            [deviceStatusRows],
            [deviceTypeRows],
            [zoneStatsRows],
            [zonesData],
            [globalZonesData],
            [pondsData],
            [devicesData]
        ] = await Promise.all([
            db.execute('SELECT COUNT(*) AS unhandled_logs FROM log_he_thong WHERE acknowledged = 0'),
            db.execute(
                `SELECT
                    COUNT(*) AS total_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'HOAT_DONG' THEN 1 ELSE 0 END) AS active_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'TAT' THEN 1 ELSE 0 END) AS inactive_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'BAO_TRI' THEN 1 ELSE 0 END) AS maintenance_devices
                 FROM thiet_bi_tai_bien tbtb
                 JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
                 JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
                 ${deviceJoinFilter}
                 ${deviceWhereClause}`,
                deviceParams
            ),
            db.execute(
                `SELECT
                    COALESCE(cb.loai_cam_bien, dk.loai_thiet_bi, tbtb.loai_phan_loai) AS device_label,
                    COUNT(*) AS total_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'HOAT_DONG' THEN 1 ELSE 0 END) AS active_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'TAT' THEN 1 ELSE 0 END) AS inactive_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'BAO_TRI' THEN 1 ELSE 0 END) AS maintenance_devices
                 FROM thiet_bi_tai_bien tbtb
                 JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
                 JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
                 ${deviceJoinFilter}
                 LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
                 LEFT JOIN thiet_bi_dieu_khien dk ON dk.ma_thiet_bi = tbtb.ma_thiet_bi
                 ${deviceWhereClause}
                 GROUP BY device_label
                 ORDER BY total_devices DESC, device_label ASC`,
                deviceParams
            ),
            db.execute(
                `SELECT
                    an.ma_khu_vuc AS KhuVuc_ID,
                    COUNT(*) AS total_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'HOAT_DONG' THEN 1 ELSE 0 END) AS active_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'TAT' THEN 1 ELSE 0 END) AS inactive_devices,
                    SUM(CASE WHEN tbtb.trang_thai = 'BAO_TRI' THEN 1 ELSE 0 END) AS maintenance_devices
                 FROM thiet_bi_tai_bien tbtb
                 JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
                 JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
                 ${deviceJoinFilter}
                 ${deviceWhereClause}
                 GROUP BY an.ma_khu_vuc
                 ORDER BY total_devices DESC, an.ma_khu_vuc ASC`,
                deviceParams
            ),
            db.execute(
                `SELECT
                    kv.ma_khu_vuc AS KhuVuc_ID,
                    kv.loai_thuy_san AS LoaiHaiSan,
                    kv.ma_nguoi_dung_quan_ly AS managerId,
                    nd.ten_dang_nhap AS manager,
                    COUNT(DISTINCT an.ma_ao_nuoi) AS so_ao,
                    SUM(an.dien_tich) AS tong_dien_tich
                 FROM khu_vuc kv
                 LEFT JOIN nguoi_dung nd ON nd.ma_nguoi_dung = kv.ma_nguoi_dung_quan_ly
                 LEFT JOIN ao_nuoi an ON kv.ma_khu_vuc = an.ma_khu_vuc
                 ${zoneFilter}
                 GROUP BY kv.ma_khu_vuc, kv.loai_thuy_san, kv.ma_nguoi_dung_quan_ly, nd.ten_dang_nhap`,
                queryParams
            ),
            db.execute(
                `SELECT
                    kv.ma_khu_vuc AS KhuVuc_ID,
                    kv.loai_thuy_san AS LoaiHaiSan,
                    COUNT(DISTINCT an.ma_ao_nuoi) AS so_ao,
                    SUM(an.dien_tich) AS tong_dien_tich
                 FROM khu_vuc kv
                 LEFT JOIN ao_nuoi an ON kv.ma_khu_vuc = an.ma_khu_vuc
                 GROUP BY kv.ma_khu_vuc, kv.loai_thuy_san`
            ),
            db.execute(
                `SELECT ma_ao_nuoi AS AoNuoi_ID, ma_khu_vuc AS KhuVuc_ID, dien_tich
                 FROM ao_nuoi an
                 ${pondFilter}`,
                queryParams
            ),
            db.execute(
                `SELECT
                    tbtb.ma_thiet_bi,
                    tbtb.ma_tram,
                    tbtb.trang_thai,
                    tb.ma_ao_nuoi AS AoNuoi_ID,
                    COALESCE(cb.loai_cam_bien, dk.loai_thiet_bi, tbtb.loai_phan_loai) AS ten_thiet_bi
                 FROM thiet_bi_tai_bien tbtb
                 JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
                 JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
                 ${deviceJoinFilter}
                 LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
                 LEFT JOIN thiet_bi_dieu_khien dk ON dk.ma_thiet_bi = tbtb.ma_thiet_bi
                 ${deviceWhereClause}
                 ORDER BY tb.ma_ao_nuoi ASC, tbtb.ma_thiet_bi ASC`,
                deviceParams
            )
        ]);

        const pondsWithDevices = pondsData.map((pond) => ({
            ...pond,
            thiet_bi: devicesData.filter((device) => device.AoNuoi_ID === pond.AoNuoi_ID)
        }));

        const nestedZones = zonesData.map((zone) => ({
            ...zone,
            danh_sach_ao: pondsWithDevices.filter((pond) => pond.KhuVuc_ID === zone.KhuVuc_ID)
        }));

        const deviceStatus = {
            total: toNumber(deviceStatusRows[0]?.total_devices),
            active: toNumber(deviceStatusRows[0]?.active_devices),
            inactive: toNumber(deviceStatusRows[0]?.inactive_devices),
            maintenance: toNumber(deviceStatusRows[0]?.maintenance_devices)
        };

        res.json({
            cards: {
                total_devices: deviceStatus.total,
                active_devices: deviceStatus.active,
                inactive_devices: deviceStatus.inactive,
                maintenance_devices: deviceStatus.maintenance,
                unhandled_logs: toNumber(logsResult[0]?.unhandled_logs)
            },
            deviceStatus: [
                { key: 'active', label: 'Hoat dong', value: deviceStatus.active },
                { key: 'inactive', label: 'Khong hoat dong', value: deviceStatus.inactive },
                { key: 'maintenance', label: 'Bao tri', value: deviceStatus.maintenance }
            ],
            deviceTypes: deviceTypeRows.map((row) => ({
                device_label: row.device_label,
                total_devices: toNumber(row.total_devices),
                active_devices: toNumber(row.active_devices),
                inactive_devices: toNumber(row.inactive_devices),
                maintenance_devices: toNumber(row.maintenance_devices)
            })),
            zoneDeviceStats: zoneStatsRows.map((row) => ({
                KhuVuc_ID: row.KhuVuc_ID,
                total_devices: toNumber(row.total_devices),
                active_devices: toNumber(row.active_devices),
                inactive_devices: toNumber(row.inactive_devices),
                maintenance_devices: toNumber(row.maintenance_devices)
            })),
            zones: nestedZones,
            globalZones: globalZonesData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
