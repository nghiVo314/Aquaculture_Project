const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth, requirePermission } = require('../middlewares/rbac');
//flag khi có thây đổi
let needsReload = false;

router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT a.*, t.ma_tram, t.trang_thai_cloud 
            FROM ao_nuoi a
            LEFT JOIN tram_bien t ON a.ma_ao_nuoi = t.ma_ao_nuoi
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// THÊM AO - Chỉ dành cho user có quyền 'pond:create'
router.post('/', requireAuth, requirePermission('pond:create'), async (req, res) => {
    const { ma_ao_nuoi, ma_khu_vuc, dien_tich } = req.body; 
    const connection = await db.getConnection(); // Sử dụng connection riêng để dùng Transaction
    
    try {
        await connection.beginTransaction();

        // 1. Kiểm tra giới hạn ao
        const [result] = await connection.execute(
            'SELECT COUNT(*) as total FROM ao_nuoi WHERE ma_khu_vuc = ?', 
            [ma_khu_vuc]
        );
        if (result[0].total >= 10) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'Khu vực này đã đạt tối đa 10 ao nuôi!' });
        }

        // 2. Thêm ao nuôi
        await connection.execute(
            'INSERT INTO ao_nuoi (ma_ao_nuoi, ma_khu_vuc, dien_tich) VALUES (?, ?, ?)',
            [ma_ao_nuoi, ma_khu_vuc, dien_tich]
        );

        // 3. Tự động tạo 1 Trạm (Gateway) cho ao này
        const ma_tram = `TRAM_${ma_ao_nuoi}`;
        await connection.execute(
            'INSERT INTO tram_bien (ma_tram, ma_ao_nuoi, trang_thai_cloud) VALUES (?, ?, ?)',
            [ma_tram, ma_ao_nuoi, 'CONNECTED']
        );

        // 4. Khởi tạo danh sách Cảm biến (DO, PH, TEMP)
        const sensors = [
            // { id: `CB_DO_${ma_ao_nuoi}`, type: 'DO' },
            // { id: `CB_PH_${ma_ao_nuoi}`, type: 'PH' },
            { id: `CB_TEMP_${ma_ao_nuoi}`, type: 'TEMP' },
            { id: `CB_LIGHT_${ma_ao_nuoi}`, type: 'LIGHT' }
        ];

        for (let s of sensors) {
            await connection.execute('INSERT INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, loai_phan_loai, trang_thai) VALUES (?, ?, ?, ?)', [s.id, ma_tram, 'CAM_BIEN', 'TAT']);
            await connection.execute('INSERT INTO cam_bien (ma_thiet_bi, loai_cam_bien) VALUES (?, ?)', [s.id, s.type]);
        }

        // 5. Khởi tạo danh sách Thiết bị điều khiển (AERATOR, PUMP, FAN, FEEDER)
        const actuators = [
            //{ id: `DK_AERATOR_${ma_ao_nuoi}`, type: 'AERATOR' },
            { id: `DK_PUMP_${ma_ao_nuoi}`, type: 'PUMP' },
            { id: `DK_FAN_${ma_ao_nuoi}`, type: 'FAN' },
            { id: `DK_FEEDER_${ma_ao_nuoi}`, type: 'FEEDER' } 
        ];

        for (let a of actuators) {
            await connection.execute('INSERT INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, loai_phan_loai, trang_thai) VALUES (?, ?, ?, ?)', [a.id, ma_tram, 'DIEU_KHIEN', 'TAT']);
            await connection.execute('INSERT INTO thiet_bi_dieu_khien (ma_thiet_bi, loai_thiet_bi) VALUES (?, ?)', [a.id, a.type]);
        }

        // 6. Khởi tạo Rule mặc định nối Cảm biến với Thiết bị điều khiển
        // Giả định: DO -> AERATOR, PH -> PUMP, TEMP -> FAN
        const rules = [
            // { id: `RULE_DO_${ma_ao_nuoi}`, cb: `CB_DO_${ma_ao_nuoi}`, dk: `DK_AERATOR_${ma_ao_nuoi}`, min: 5.0, max: 7.0 },
            // { id: `RULE_PH_${ma_ao_nuoi}`, cb: `CB_PH_${ma_ao_nuoi}`, dk: `DK_PUMP_${ma_ao_nuoi}`, min: 5.0, max: 8.0 },
            { id: `RULE_TEMP_${ma_ao_nuoi}`, cb: `CB_TEMP_${ma_ao_nuoi}`, dk: `DK_FAN_${ma_ao_nuoi}`, min: 25.0, max: 28.0 },
            { id: `RULE_LIGHT_${ma_ao_nuoi}`, cb: `CB_LIGHT_${ma_ao_nuoi}`, dk: `DK_FEEDER_${ma_ao_nuoi}`, min: 9.0, max: 40.0 }
        ];

        for (let r of rules) {
            await connection.execute(
                'INSERT INTO rule_dieu_khien (ma_rule, ma_cam_bien, ma_tb_dieu_khien, min_value, max_value) VALUES (?, ?, ?, ?, ?)',
                [r.id, r.cb, r.dk, r.min, r.max]
            );
        }

        await connection.commit();
        needsReload = true; //bật cờ sau khi add ao
        res.json({ status: 'added', message: 'Thêm ao nuôi và khởi tạo hệ thống thiết bị thành công' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
        console.error('Lỗi khi thêm ao mới:', error);
    } finally {
        connection.release();
    }
});

// GET config for Gateway (Lấy ngưỡng hiện tại của ao để gửi cho main.py)
router.get('/:ao_id/config', async (req, res) => {
    try {

        const [[pond]] = await db.execute(
            `SELECT che_do
             FROM ao_nuoi
             WHERE ma_ao_nuoi = ?`,
            [req.params.ao_id]
        );

        const [configs] = await db.execute(
            `SELECT 
                cb.loai_cam_bien AS LoaiCamBien, 
                r.min_value, 
                r.max_value, 
                r.ma_rule, 
                cb.ma_thiet_bi AS ma_cam_bien,
                (SELECT gia_tri
                 FROM du_lieu_quan_trac
                 WHERE ma_cam_bien = cb.ma_thiet_bi
                 ORDER BY thoi_gian DESC
                 LIMIT 1) AS latest_value
             FROM rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?`,
            [req.params.ao_id]
        );

        res.json({
            ao_id: req.params.ao_id,
            che_do: pond?.che_do || 'AUTO',
            configs
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SỬA CẤU HÌNH AO - Chỉ dành cho user có quyền 'pond:update:config'
router.put('/:ao_id/config', requireAuth, requirePermission('pond:update:config'), async (req, res) => {
    const { LoaiCamBien, min_value, max_value } = req.body;
    try {
        // Cập nhật bảng rule_dieu_khien dựa trên mã ao và loại cảm biến
        const [result] = await db.execute(
            `UPDATE rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             SET r.min_value = ?, r.max_value = ?
             WHERE tb.ma_ao_nuoi = ? AND cb.loai_cam_bien = ?`,
            [min_value, max_value, req.params.ao_id, LoaiCamBien]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy rule cho cảm biến này trong ao' });
        }
        res.json({ status: 'updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CẬP NHẬT THÔNG TIN AO - Chỉ dành cho user có quyền 'pond:update'
router.put('/:id', requireAuth, requirePermission('pond:update'), async (req, res) => {
    const { dien_tich } = req.body;
    try {
        await db.execute(
            'UPDATE ao_nuoi SET dien_tich = ? WHERE ma_ao_nuoi = ?',
            [dien_tich, req.params.id]
        );
        res.json({ status: 'updated', message: 'Cập nhật ao thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// XÓA AO - Chỉ dành cho user có quyền 'pond:delete'
router.delete('/:id', requireAuth, requirePermission('pond:delete'), async (req, res) => {
    try {
        await db.execute('DELETE FROM ao_nuoi WHERE ma_ao_nuoi = ?', [req.params.id]);
        needsReload = true; //bật cờ sau khi xóa ao
        res.json({ status: 'deleted', message: 'Đã xóa ao nuôi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// lấy dữ liệu của ao để khởi tạo cho Gateway (main.py) khi mới khởi động
router.get('/gateway-init', async (req, res) => {
    try {
        // 1. Lấy danh sách tất cả các Trạm (đóng vai trò là Gateway) và Ao nuôi
        const [stations] = await db.execute(`
            SELECT tb.ma_tram as gateway_id, tb.ma_ao_nuoi as ao_id
            FROM tram_bien tb
        `);

        // 2. Lấy toàn bộ thiết bị (cảm biến & điều khiển) và join với bảng chi tiết tương ứng
        const [devices] = await db.execute(`
            SELECT 
                tbtb.ma_tram,
                tbtb.loai_phan_loai,
                cb.loai_cam_bien,
                cb.ma_thiet_bi as ma_cam_bien,
                dk.loai_thiet_bi,
                dk.ma_thiet_bi as ma_dieu_khien
            FROM thiet_bi_tai_bien tbtb
            LEFT JOIN cam_bien cb ON tbtb.ma_thiet_bi = cb.ma_thiet_bi AND tbtb.loai_phan_loai = 'CAM_BIEN'
            LEFT JOIN thiet_bi_dieu_khien dk ON tbtb.ma_thiet_bi = dk.ma_thiet_bi AND tbtb.loai_phan_loai = 'DIEU_KHIEN'
        `);

        // 3. Xử lý dữ liệu (Map & Filter) để tạo ra mảng JSON theo yêu cầu của main.py
        const result = stations.map(station => {
            // Lọc ra các thiết bị thuộc về trạm hiện tại
            const stationDevices = devices.filter(d => d.ma_tram === station.gateway_id);
            
            // Gom các ID cảm biến thành 1 object: { "TEMP": "CB01", "DO": "CB02", ... }
            const sensor_ids = {};
            stationDevices
                .filter(d => d.loai_phan_loai === 'CAM_BIEN' && d.ma_cam_bien)
                .forEach(sensor => {
                    // UPPERCASE để đảm bảo chuẩn format với key trong Python (VD: temp -> TEMP)
                    const loaiCB = (sensor.loai_cam_bien || '').toUpperCase();
                    sensor_ids[loaiCB] = sensor.ma_cam_bien; 
                });

            // Tìm thiết bị điều khiển đóng vai trò là Máy Cho Ăn (Feeder)
            // LƯU Ý: Chữ 'FEEDER' ở đây phải khớp với data bạn nhập trong cột loai_thiet_bi của DB
            const feeder = stationDevices.find(d => 
                d.loai_phan_loai === 'DIEU_KHIEN' && 
                (d.loai_thiet_bi === 'FEEDER' || d.loai_thiet_bi === 'MAY_CHO_AN')
            );

            return {
                gateway_id: station.gateway_id,
                ao_id: station.ao_id,
                feeder_id: feeder ? feeder.ma_dieu_khien : null,
                sensor_ids: sensor_ids
            };
        });

        // 4. Trả về kết quả
        res.json(result);

    } catch (error) {
        console.error("Lỗi khi init gateway:", error);
        res.status(500).json({ error: error.message });
    }
});

// API kiểm tra trạng thái dành riêng cho main.py
router.get('/check-reload', (req, res) => {
    res.json({ reload: needsReload });
    // Sau khi trả về true, reset lại cờ về false để không reload lặp lại
    if (needsReload) needsReload = false; 
});

// Cập nhật chế độ điều khiển của ao (AUTO / MANUAL)
router.put('/:id/mode', requireAuth, requirePermission('pond:update:config'), async (req, res) => {
    const { che_do } = req.body; // 'AUTO' hoặc 'MANUAL'
    try {
        await db.execute(
            'UPDATE ao_nuoi SET che_do = ? WHERE ma_ao_nuoi = ?',
            [che_do, req.params.id]
        );
        res.json({ status: 'success', message: `Đã chuyển ao sang chế độ ${che_do}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ponds/report-summary
router.get('/report-summary', async (req, res) => {
    try {
        // Lấy danh sách khu vực
        const [zones] = await db.execute(`
            SELECT ma_khu_vuc, loai_thuy_san
            FROM khu_vuc
            ORDER BY ma_khu_vuc
        `);

        const reportData = [];

        for (const zone of zones) {
            // Lấy danh sách ao + giá trị TEMP / LIGHT mới nhất
            const [ponds] = await db.execute(`
                SELECT 
                    a.ma_ao_nuoi,
                    a.dien_tich,
                    a.che_do,
                    t.trang_thai_cloud,

                    -- nhiệt độ mới nhất
                    (
                        SELECT dl.gia_tri
                        FROM du_lieu_quan_trac dl
                        JOIN cam_bien cb ON dl.ma_cam_bien = cb.ma_thiet_bi
                        WHERE cb.loai_cam_bien = 'TEMP'
                          AND cb.ma_thiet_bi IN (
                              SELECT tb2.ma_thiet_bi
                              FROM thiet_bi_tai_bien tb2
                              WHERE tb2.ma_tram = t.ma_tram
                          )
                        ORDER BY dl.thoi_gian DESC
                        LIMIT 1
                    ) AS nhiet_do_hien_tai,

                    -- ánh sáng mới nhất
                    (
                        SELECT dl.gia_tri
                        FROM du_lieu_quan_trac dl
                        JOIN cam_bien cb ON dl.ma_cam_bien = cb.ma_thiet_bi
                        WHERE cb.loai_cam_bien = 'LIGHT'
                          AND cb.ma_thiet_bi IN (
                              SELECT tb2.ma_thiet_bi
                              FROM thiet_bi_tai_bien tb2
                              WHERE tb2.ma_tram = t.ma_tram
                          )
                        ORDER BY dl.thoi_gian DESC
                        LIMIT 1
                    ) AS anh_sang_hien_tai

                FROM ao_nuoi a
                LEFT JOIN tram_bien t ON a.ma_ao_nuoi = t.ma_ao_nuoi
                WHERE a.ma_khu_vuc = ?
                ORDER BY a.ma_ao_nuoi
            `, [zone.ma_khu_vuc]);

            reportData.push({
                ma_khu_vuc: zone.ma_khu_vuc,
                loai_thuy_san: zone.loai_thuy_san,
                danh_sach_ao: ponds
            });
        }

        res.json(reportData);

    } catch (error) {
        console.error('report-summary error:', error);
        res.status(500).json({ error: error.message });
    }
});


// GET /api/ponds/sensor-report?days=7&type=TEMP
router.get('/sensor-report', async (req, res) => {
    const days = parseInt(req.query.days || 7);
    const type = (req.query.type || 'TEMP').toUpperCase(); // TEMP | LIGHT

    try {
        const [rows] = await db.execute(`
            SELECT
                an.ma_ao_nuoi,
                DATE_FORMAT(dl.thoi_gian, '%Y-%m-%d %H:%i:%s') AS thoi_gian,
                dl.gia_tri,
                cb.loai_cam_bien
            FROM du_lieu_quan_trac dl
            JOIN cam_bien cb 
                ON dl.ma_cam_bien = cb.ma_thiet_bi
            JOIN thiet_bi_tai_bien tb 
                ON cb.ma_thiet_bi = tb.ma_thiet_bi
            JOIN tram_bien tr 
                ON tb.ma_tram = tr.ma_tram
            JOIN ao_nuoi an 
                ON tr.ma_ao_nuoi = an.ma_ao_nuoi
            WHERE cb.loai_cam_bien = ?
              AND dl.thoi_gian >= NOW() - INTERVAL ? DAY
            ORDER BY dl.thoi_gian ASC
        `, [type, days]);

        res.json(rows);

    } catch (error) {
        console.error('sensor-report error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;;