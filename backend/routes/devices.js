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
            `SELECT 
                lt.ma_lich_trinh,
                lt.thoi_gian_bat_dau AS start_time,
                lt.thoi_gian_ket_thuc AS end_time,
                lt.ma_tb_dieu_khien AS ThietBiTaiBien_ID,
                lt.ma_cong_thuc,
                tbdk.loai_thiet_bi AS LoaiThietBi
             FROM lich_trinh lt
             JOIN thiet_bi_dieu_khien tbdk 
                ON lt.ma_tb_dieu_khien = tbdk.ma_thiet_bi
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
            `SELECT 
                lt.ma_lich_trinh,
                lt.thoi_gian_bat_dau AS start_time,
                lt.thoi_gian_ket_thuc AS end_time,
                lt.ma_tb_dieu_khien,
                lt.ma_cong_thuc
             FROM lich_trinh lt
             WHERE lt.ma_tb_dieu_khien = ?
               AND lt.thoi_gian_ket_thuc >= CURTIME()
             ORDER BY lt.thoi_gian_bat_dau ASC`,
            [req.params.thietbi_id]
        );

        res.json({ thietbi_id: req.params.thietbi_id, schedules });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cập nhật trạng thái thiết bị - Yêu cầu quyền 'device:status:update'...........tạm thời bỏ auth để gateway gọi dễ hơn
// router.put('/:id/status', requireAuth, requirePermission('device:status:update'), async (req, res) => {
router.put('/:id/status', async (req, res) => {
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


//lấy status của các thiết bị cho gateway
router.get('/gateway/status/:pond_id', async (req, res) => {
    try {
        const [devices] = await db.execute(
            `SELECT tbdk.loai_thiet_bi, tbtb.trang_thai 
             FROM thiet_bi_tai_bien tbtb
             JOIN thiet_bi_dieu_khien tbdk ON tbtb.ma_thiet_bi = tbdk.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?`,
            [req.params.pond_id]
        );
        res.json({ pond_id: req.params.pond_id, devices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm vào backend/routes/devices.js
router.post('/schedules', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { ma_tb_dieu_khien, start_time, end_time, ma_cong_thuc } = req.body;

    try {
        await db.execute(
            `INSERT INTO lich_trinh 
                (ma_tb_dieu_khien, thoi_gian_bat_dau, thoi_gian_ket_thuc, ma_cong_thuc)
             VALUES (?, ?, ?, ?)`,
            [ma_tb_dieu_khien, start_time, end_time, ma_cong_thuc || null]
        );
        res.json({ status: 'success', message: 'Thêm lịch trình thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Xóa lịch trình - Yêu cầu quyền 'device:status:update'
router.delete('/schedules/:id', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    try {
        await db.execute('DELETE FROM lich_trinh WHERE ma_lich_trinh = ?', [req.params.id]);
        res.json({ status: 'success', message: 'Đã xóa lịch trình' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Lấy công thức cho ăn để hiển thị trong form tạo lịch trình
router.get('/feeding-formulas', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT ma_cong_thuc, ti_le_cho_an, thong_tin_bo_sung
             FROM cong_thuc_cho_an
             ORDER BY ma_cong_thuc ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thêm công thức cho ăn mới - Yêu cầu quyền 'device:status:update'
router.post('/feeding-formulas', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { ma_cong_thuc, ti_le_cho_an, thong_tin_bo_sung } = req.body;
    try {
        await db.execute(
            `INSERT INTO cong_thuc_cho_an (ma_cong_thuc, ti_le_cho_an, thong_tin_bo_sung)
             VALUES (?, ?, ?)`,
            [ma_cong_thuc, ti_le_cho_an || null, thong_tin_bo_sung || null]
        );
        res.json({ status: 'success', message: 'Đã thêm công thức' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Xóa công thức cho ăn - Yêu cầu quyền 'device:status:update'
router.delete('/feeding-formulas/:id', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    try {
        await db.execute('DELETE FROM cong_thuc_cho_an WHERE ma_cong_thuc = ?', [req.params.id]);
        res.json({ status: 'success', message: 'Đã xóa công thức' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Lấy danh sách lịch sử cho ăn (dành cho React)
router.get('/feeding-history', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT * FROM ghi_chep_cho_an ORDER BY thoi_gian_cho_an DESC LIMIT 50`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Ghi nhận lịch sử cho ăn (dành cho Gateway Python gọi, không cần requireAuth để Gateway gọi dễ dàng)
router.post('/feeding-history', async (req, res) => {
    let { ma_cong_thuc, ma_tb_dieu_khien, muc_do_them_an, bang_chung_hinh_anh } = req.body;

    try {
        // Nếu gateway chưa gửi ma_cong_thuc thì backend tự suy ra từ lịch trình đang active
        if (!ma_cong_thuc && ma_tb_dieu_khien) {
            const [activeRows] = await db.execute(
                `SELECT lt.ma_cong_thuc
                 FROM lich_trinh lt
                 WHERE lt.ma_tb_dieu_khien = ?
                   AND CURTIME() BETWEEN lt.thoi_gian_bat_dau AND lt.thoi_gian_ket_thuc
                 ORDER BY lt.thoi_gian_bat_dau DESC
                 LIMIT 1`,
                [ma_tb_dieu_khien]
            );
            ma_cong_thuc = activeRows[0]?.ma_cong_thuc || null;
        }

        await db.execute(
            `INSERT INTO ghi_chep_cho_an 
                (ma_cong_thuc, ma_tb_dieu_khien, thoi_gian_cho_an, muc_do_them_an, bang_chung_hinh_anh) 
             VALUES (?, ?, NOW(), ?, ?)`,
            [
                ma_cong_thuc,
                ma_tb_dieu_khien,
                muc_do_them_an || null,
                bang_chung_hinh_anh || null
            ]
        );

        res.json({ status: 'success', message: 'Đã lưu lịch sử cho ăn' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;