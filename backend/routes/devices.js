const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Đã thay authorizeRoles bằng requirePermission
const { requireAuth, requirePermission } = require('../middlewares/rbac');

// Xem danh sách trạm
router.get('/stations', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT tb.ma_tram, tb.ma_ao_nuoi, tb.trang_thai_cloud
             FROM tram_bien tb
             ORDER BY tb.ma_tram ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm trạm - Yêu cầu quyền 'station:create'
router.post('/stations', requireAuth, requirePermission('station:create'), async (req, res) => {
    const { ma_tram, ma_ao_nuoi, trang_thai_cloud } = req.body;

    if (!ma_tram || !ma_ao_nuoi) {
        return res.status(400).json({ status: 'error', message: 'Thiếu mã trạm hoặc mã ao nuôi' });
    }

    try {
        await db.execute(
            'INSERT INTO tram_bien (ma_tram, ma_ao_nuoi, trang_thai_cloud) VALUES (?, ?, ?)',
            [ma_tram, ma_ao_nuoi, trang_thai_cloud || 'online']
        );
        res.json({ status: 'added', message: 'Thêm trạm biên thành công' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Xóa trạm - Yêu cầu quyền 'station:delete'
router.delete('/stations/:id', requireAuth, requirePermission('station:delete'), async (req, res) => {
    try {
        await db.execute('DELETE FROM tram_bien WHERE ma_tram = ?', [req.params.id]);
        res.json({ status: 'deleted', message: 'Đã xóa trạm biên' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Xem danh sách thiết bị
router.get('/inventory', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT tbtb.ma_thiet_bi, tbtb.ma_tram, tbtb.trang_thai,
                    cb.loai_cam_bien,
                    tbdk.loai_thiet_bi
             FROM thiet_bi_tai_bien tbtb
             LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             LEFT JOIN thiet_bi_dieu_khien tbdk ON tbdk.ma_thiet_bi = tbtb.ma_thiet_bi
             ORDER BY tbtb.ma_thiet_bi ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm thiết bị - Yêu cầu quyền 'device:create'
router.post('/inventory', requireAuth, requirePermission('device:create'), async (req, res) => {
    const { ma_thiet_bi, ma_tram, nhom_thiet_bi, loai_thiet_bi, trang_thai } = req.body;
    const connection = await db.getConnection();

    if (!ma_thiet_bi || !ma_tram || !nhom_thiet_bi) {
        return res.status(400).json({ status: 'error', message: 'Thiếu mã thiết bị, mã trạm hoặc nhóm thiết bị' });
    }

    try {
        await connection.beginTransaction();

        await connection.execute(
            'INSERT INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, trang_thai) VALUES (?, ?, ?)',
            [ma_thiet_bi, ma_tram, trang_thai || 'OFF']
        );

        if (nhom_thiet_bi === 'sensor') {
            await connection.execute(
                'INSERT INTO cam_bien (ma_thiet_bi, loai_cam_bien) VALUES (?, ?)',
                [ma_thiet_bi, loai_thiet_bi || 'UNSPECIFIED']
            );
        } else {
            await connection.execute(
                'INSERT INTO thiet_bi_dieu_khien (ma_thiet_bi, loai_thiet_bi) VALUES (?, ?)',
                [ma_thiet_bi, loai_thiet_bi || 'UNSPECIFIED']
            );
        }

        await connection.commit();
        res.json({ status: 'added', message: 'Thêm thiết bị thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

// Xóa thiết bị - Yêu cầu quyền 'device:delete'
router.delete('/inventory/:id', requireAuth, requirePermission('device:delete'), async (req, res) => {
    const deviceId = req.params.id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        await connection.execute('DELETE FROM cam_bien WHERE ma_thiet_bi = ?', [deviceId]);
        await connection.execute('DELETE FROM thiet_bi_dieu_khien WHERE ma_thiet_bi = ?', [deviceId]);
        await connection.execute('DELETE FROM thiet_bi_tai_bien WHERE ma_thiet_bi = ?', [deviceId]);
        await connection.commit();

        res.json({ status: 'deleted', message: 'Đã xóa thiết bị' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

// Lịch trình - Cần đăng nhập
router.get('/', requireAuth, async (req, res) => {
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

// Gateway đồng bộ lịch trình - Giữ nguyên không check quyền để main.py có thể gọi
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

// Cập nhật trạng thái thiết bị - Yêu cầu quyền 'device:status:update'
router.put('/:id/status', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { trang_thai } = req.body;
    try {
        await db.execute(
            'UPDATE thiet_bi_tai_bien SET trang_thai = ? WHERE ma_thiet_bi = ?',
            [trang_thai, req.params.id]
        );
        res.json({ status: 'updated', message: 'Cập nhật trạng thái thiết bị thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm vào backend/routes/devices.js
router.post('/schedules', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { ma_tb_dieu_khien, start_time, end_time } = req.body;
    try {
        await db.execute(
            'INSERT INTO lich_trinh (ma_tb_dieu_khien, thoi_gian_bat_dau, thoi_gian_ket_thuc) VALUES (?, ?, ?)',
            [ma_tb_dieu_khien, start_time, end_time]
        );
        res.json({ status: 'success', message: 'Thêm lịch trình thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/schedules/:id', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    try {
        await db.execute('DELETE FROM lich_trinh WHERE ma_lich_trinh = ?', [req.params.id]);
        res.json({ status: 'success', message: 'Đã xóa lịch trình' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;