const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth, requirePermission } = require('../middlewares/rbac');
const { listAlertHistory } = require('../services/alerts');

function parseTimeToMinutes(value) {
    if (!value || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
    const [hh, mm] = value.split(':').map(Number);
    return hh * 60 + mm;
}

function overlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

function normalizeDeviceGroup(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'CAM_BIEN' || normalized === 'SENSOR') return 'CAM_BIEN';
    if (normalized === 'DIEU_KHIEN' || normalized === 'CONTROL' || normalized === 'CONTROLLER') return 'DIEU_KHIEN';
    return '';
}

function normalizeDeviceStatus(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'HOAT_DONG' || normalized === 'ON') return 'HOAT_DONG';
    if (normalized === 'BAO_TRI' || normalized === 'MAINTENANCE') return 'BAO_TRI';
    return 'TAT';
}

function normalizeDeviceType(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function sanitizeCodePart(value, fallback) {
    const normalized = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

async function hasPondWorkersTable(connection = db) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ao_nuoi_workers'`
    );
    return Number(rows?.[0]?.total || 0) > 0;
}

async function generateDeviceId(connection, stationId, deviceType) {
    const [[station]] = await connection.execute(
        `SELECT tb.ma_tram, tb.ma_ao_nuoi, an.ma_khu_vuc
         FROM tram_bien tb
         JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
         WHERE tb.ma_tram = ?`,
        [stationId]
    );

    if (!station) {
        throw new Error('Không tìm thấy trạm để sinh mã thiết bị');
    }

    const zoneCode = sanitizeCodePart(station.ma_khu_vuc, 'KV');
    const pondCode = sanitizeCodePart(station.ma_ao_nuoi, 'AO');
    const typeCode = sanitizeCodePart(deviceType, 'DEVICE');
    const prefix = `${zoneCode}_${pondCode}_${typeCode}_`;

    const [existingRows] = await connection.execute(
        `SELECT ma_thiet_bi
         FROM thiet_bi_tai_bien
         WHERE ma_thiet_bi LIKE ?`,
        [`${prefix}%`]
    );

    let nextNumber = 1;
    for (const row of existingRows) {
        const match = String(row.ma_thiet_bi || '').match(/_(\d+)$/);
        if (!match) continue;
        nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
    }

    return `${prefix}${String(nextNumber).padStart(2, '0')}`;
}

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

router.post('/stations', requireAuth, requirePermission('station:create'), async (req, res) => {
    const { ma_tram, ma_ao_nuoi, trang_thai_cloud } = req.body;

    if (!ma_tram || !ma_ao_nuoi) {
        return res.status(400).json({ status: 'error', message: 'Thiếu mã trạm hoặc mã ao nuôi' });
    }

    try {
        await db.execute(
            'INSERT INTO tram_bien (ma_tram, ma_ao_nuoi, trang_thai_cloud) VALUES (?, ?, ?)',
            [ma_tram, ma_ao_nuoi, String(trang_thai_cloud || 'CONNECTED').toUpperCase()]
        );
        res.json({ status: 'added', message: 'Thêm trạm thành công' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.delete('/stations/:id', requireAuth, requirePermission('station:delete'), async (req, res) => {
    try {
        await db.execute('DELETE FROM tram_bien WHERE ma_tram = ?', [req.params.id]);
        res.json({ status: 'deleted', message: 'Đã xóa trạm' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.get('/inventory', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                tbtb.ma_thiet_bi,
                tbtb.ma_tram,
                tbtb.loai_phan_loai,
                tbtb.trang_thai,
                tb.trang_thai_cloud,
                tb.ma_ao_nuoi,
                an.ma_khu_vuc,
                cb.loai_cam_bien,
                tbdk.loai_thiet_bi
             FROM thiet_bi_tai_bien tbtb
             JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
             JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
             LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             LEFT JOIN thiet_bi_dieu_khien tbdk ON tbdk.ma_thiet_bi = tbtb.ma_thiet_bi
             ORDER BY tbtb.ma_thiet_bi ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/inventory/by-zone/:zoneId', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                tbtb.ma_thiet_bi,
                tbtb.ma_tram,
                tbtb.loai_phan_loai,
                tbtb.trang_thai,
                tb.trang_thai_cloud,
                tb.ma_ao_nuoi,
                an.ma_khu_vuc,
                cb.loai_cam_bien,
                tbdk.loai_thiet_bi
             FROM thiet_bi_tai_bien tbtb
             JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
             JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
             LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             LEFT JOIN thiet_bi_dieu_khien tbdk ON tbdk.ma_thiet_bi = tbtb.ma_thiet_bi
             WHERE an.ma_khu_vuc = ?
             ORDER BY an.ma_ao_nuoi ASC, tbtb.ma_thiet_bi ASC`,
            [req.params.zoneId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/inventory', requireAuth, requirePermission('device:create'), async (req, res) => {
    const { ma_tram, nhom_thiet_bi, loai_thiet_bi, trang_thai } = req.body;
    const connection = await db.getConnection();
    const loaiPhanLoai = normalizeDeviceGroup(nhom_thiet_bi);
    const normalizedStatus = normalizeDeviceStatus(trang_thai);
    const normalizedType = normalizeDeviceType(loai_thiet_bi);

    if (!ma_tram || !loaiPhanLoai || !normalizedType) {
        return res.status(400).json({ status: 'error', message: 'Thiếu mã trạm, nhóm thiết bị hoặc loại thiết bị' });
    }

    try {
        await connection.beginTransaction();
        const finalDeviceId = await generateDeviceId(connection, ma_tram, normalizedType);

        await connection.execute(
            'INSERT INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, loai_phan_loai, trang_thai) VALUES (?, ?, ?, ?)',
            [finalDeviceId, ma_tram, loaiPhanLoai, normalizedStatus]
        );

        if (loaiPhanLoai === 'CAM_BIEN') {
            await connection.execute(
                'INSERT INTO cam_bien (ma_thiet_bi, loai_cam_bien) VALUES (?, ?)',
                [finalDeviceId, normalizedType]
            );
        } else {
            await connection.execute(
                'INSERT INTO thiet_bi_dieu_khien (ma_thiet_bi, loai_thiet_bi) VALUES (?, ?)',
                [finalDeviceId, normalizedType]
            );
        }

        await connection.commit();
        res.json({ status: 'added', message: 'Thêm thiết bị thành công', ma_thiet_bi: finalDeviceId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

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

router.get('/overview', requireAuth, async (req, res) => {
    try {
        const isAdmin = Array.isArray(req.user?.roles) && req.user.roles.includes('admin');
        const isManager = Array.isArray(req.user?.roles) && req.user.roles.includes('manager');
        const isWorker = Array.isArray(req.user?.roles) && req.user.roles.includes('worker');
        const supportMultiWorkers = await hasPondWorkersTable();
        const params = [];
        let scopeJoin = '';
        let scopeWhere = '';

        if (!isAdmin) {
            if (isManager) {
                scopeWhere = 'WHERE kv.ma_nguoi_dung_quan_ly = ?';
                params.push(req.user.id);
            } else if (isWorker) {
                if (supportMultiWorkers) {
                    scopeJoin = `
                        LEFT JOIN ao_nuoi_workers aow_scope
                            ON aow_scope.ma_ao_nuoi = an.ma_ao_nuoi
                           AND aow_scope.ma_nguoi_dung = ?
                    `;
                    scopeWhere = 'WHERE (aow_scope.ma_nguoi_dung IS NOT NULL OR an.ma_nguoi_dung_phu_trach = ?)';
                    params.push(req.user.id, req.user.id);
                } else {
                    scopeWhere = 'WHERE an.ma_nguoi_dung_phu_trach = ?';
                    params.push(req.user.id);
                }
            }
        }

        const [rows] = await db.execute(
            `
            SELECT
                tbtb.ma_thiet_bi,
                tbtb.loai_phan_loai,
                tbtb.trang_thai,
                tbtb.ma_tram,
                tb.trang_thai_cloud,
                tb.ma_ao_nuoi,
                an.ma_khu_vuc,
                kv.loai_thuy_san,
                cb.loai_cam_bien,
                tbdk.loai_thiet_bi,
                latest.gia_tri AS latest_value,
                latest.thoi_gian AS latest_reading_at,
                rd.min_value,
                rd.max_value,
                rd.ma_tb_dieu_khien AS linked_device_id,
                linked_ctrl.loai_thiet_bi AS linked_device_type,
                COALESCE(active_alerts.active_count, 0) AS active_alerts,
                COALESCE(history.total_alerts, 0) AS total_alerts,
                COALESCE(history.unresolved_alerts, 0) AS unresolved_alerts,
                history.last_alert_at,
                history.latest_maintenance_at
            FROM thiet_bi_tai_bien tbtb
            JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
            JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
            LEFT JOIN khu_vuc kv ON kv.ma_khu_vuc = an.ma_khu_vuc
            ${scopeJoin}
            LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
            LEFT JOIN thiet_bi_dieu_khien tbdk ON tbdk.ma_thiet_bi = tbtb.ma_thiet_bi
            LEFT JOIN rule_dieu_khien rd ON rd.ma_cam_bien = cb.ma_thiet_bi
            LEFT JOIN thiet_bi_dieu_khien linked_ctrl ON linked_ctrl.ma_thiet_bi = rd.ma_tb_dieu_khien
            LEFT JOIN (
                SELECT dl1.ma_cam_bien, dl1.gia_tri, dl1.thoi_gian
                FROM du_lieu_quan_trac dl1
                JOIN (
                    SELECT ma_cam_bien, MAX(thoi_gian) AS max_time
                    FROM du_lieu_quan_trac
                    GROUP BY ma_cam_bien
                ) latest_row
                    ON latest_row.ma_cam_bien = dl1.ma_cam_bien
                   AND latest_row.max_time = dl1.thoi_gian
            ) latest ON latest.ma_cam_bien = cb.ma_thiet_bi
            LEFT JOIN (
                SELECT ma_thiet_bi, COUNT(*) AS active_count
                FROM alert_trang_thai
                WHERE is_active = 1
                GROUP BY ma_thiet_bi
            ) active_alerts ON active_alerts.ma_thiet_bi = cb.ma_thiet_bi
            LEFT JOIN (
                SELECT
                    cb2.ma_thiet_bi,
                    COUNT(*) AS total_alerts,
                    SUM(CASE WHEN COALESCE(l.acknowledged, 0) = 0 THEN 1 ELSE 0 END) AS unresolved_alerts,
                    MAX(l.thoi_gian_khoi_tao) AS last_alert_at,
                    MAX(CASE WHEN COALESCE(l.acknowledged, 0) = 1 THEN l.thoi_gian_khoi_tao END) AS latest_maintenance_at
                FROM cam_bien cb2
                JOIN log_he_thong l
                    ON l.log_type = 'WARNING'
                   AND l.mo_ta LIKE CONCAT('%[SENSOR:', cb2.ma_thiet_bi, ']%')
                GROUP BY cb2.ma_thiet_bi
            ) history ON history.ma_thiet_bi = cb.ma_thiet_bi
            ${scopeWhere}
            ORDER BY
                COALESCE(history.unresolved_alerts, 0) DESC,
                COALESCE(history.total_alerts, 0) DESC,
                tbtb.ma_thiet_bi ASC
            `,
            params
        );

        const cards = {
            total_devices: rows.length,
            total_sensors: rows.filter((row) => row.loai_phan_loai === 'CAM_BIEN').length,
            total_controllers: rows.filter((row) => row.loai_phan_loai === 'DIEU_KHIEN').length,
            online_stations: new Set(rows
                .filter((row) => String(row.trang_thai_cloud || '').toUpperCase() === 'CONNECTED')
                .map((row) => row.ma_tram)).size,
            active_alerts: rows.reduce((sum, row) => sum + Number(row.active_alerts || 0), 0)
        };

        res.json({ cards, devices: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/inventory/:id/history', requireAuth, async (req, res) => {
    const deviceId = String(req.params.id || '').trim();
    if (!deviceId) {
        return res.status(400).json({ error: 'Thiếu mã thiết bị' });
    }

    try {
        const [[device]] = await db.execute(
            `
            SELECT
                tbtb.ma_thiet_bi,
                tbtb.loai_phan_loai,
                tbtb.trang_thai,
                tbtb.ma_tram,
                tb.trang_thai_cloud,
                tb.ma_ao_nuoi,
                an.ma_khu_vuc,
                cb.loai_cam_bien,
                tbdk.loai_thiet_bi
            FROM thiet_bi_tai_bien tbtb
            JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
            JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
            LEFT JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
            LEFT JOIN thiet_bi_dieu_khien tbdk ON tbdk.ma_thiet_bi = tbtb.ma_thiet_bi
            WHERE tbtb.ma_thiet_bi = ?
            `,
            [deviceId]
        );

        if (!device) {
            return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
        }

        let sensorIds = [];
        if (device.loai_phan_loai === 'CAM_BIEN') {
            sensorIds = [device.ma_thiet_bi];
        } else {
            const [linkedSensors] = await db.execute(
                `SELECT DISTINCT rd.ma_cam_bien
                 FROM rule_dieu_khien rd
                 WHERE rd.ma_tb_dieu_khien = ?
                 UNION
                 SELECT DISTINCT cb.ma_thiet_bi AS ma_cam_bien
                 FROM thiet_bi_tai_bien tbtb
                 JOIN cam_bien cb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
                 WHERE tbtb.ma_tram = ?`,
                [deviceId, device.ma_tram]
            );
            sensorIds = linkedSensors.map((row) => row.ma_cam_bien).filter(Boolean);
        }

        const historyChunks = await Promise.all(
            sensorIds.map((sensorId) => listAlertHistory({ user: req.user, sensorId, limit: 100 }))
        );
        const alertHistory = historyChunks
            .flat()
            .sort((a, b) => new Date(b.thoi_gian_khoi_tao || 0).getTime() - new Date(a.thoi_gian_khoi_tao || 0).getTime());

        const [feedingHistory] = device.loai_thiet_bi === 'FEEDER'
            ? await db.execute(
                `SELECT ma_ghi_chep, thoi_gian_cho_an, ma_cong_thuc, muc_do_them_an, bang_chung_hinh_anh
                 FROM ghi_chep_cho_an
                 WHERE ma_tb_dieu_khien = ?
                 ORDER BY thoi_gian_cho_an DESC
                 LIMIT 20`,
                [deviceId]
            )
            : [[]];

        res.json({
            device,
            sensor_ids: sensorIds,
            latest_maintenance_at: alertHistory.find((item) => item.acknowledged)?.thoi_gian_khoi_tao || null,
            alert_history: alertHistory,
            feeding_history: feedingHistory
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const [schedules] = await db.execute(
            `SELECT 
                lt.ma_lich_trinh,
                lt.thoi_gian_bat_dau AS start_time,
                lt.thoi_gian_ket_thuc AS end_time,
                lt.ma_tb_dieu_khien AS ThietBiTaiBien_ID,
                lt.ma_tb_dieu_khien,
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

router.put('/:id/status', async (req, res) => {
    const { trang_thai } = req.body;
    try {
        await db.execute(
            'UPDATE thiet_bi_tai_bien SET trang_thai = ? WHERE ma_thiet_bi = ?',
            [normalizeDeviceStatus(trang_thai), req.params.id]
        );
        res.json({ status: 'updated', message: 'Cập nhật trạng thái thiết bị thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

router.post('/schedules', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { ma_tb_dieu_khien, start_time, end_time, ma_cong_thuc } = req.body;

    try {
        const startMins = parseTimeToMinutes(start_time);
        const endMins = parseTimeToMinutes(end_time);
        if (!ma_tb_dieu_khien || startMins == null || endMins == null) {
            return res.status(400).json({ error: 'Thiếu thiết bị hoặc định dạng giờ không hợp lệ (HH:mm)' });
        }
        if (startMins >= endMins) {
            return res.status(400).json({ error: 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc' });
        }

        const [existingRows] = await db.execute(
            `SELECT ma_lich_trinh, thoi_gian_bat_dau, thoi_gian_ket_thuc
             FROM lich_trinh
             WHERE ma_tb_dieu_khien = ?`,
            [ma_tb_dieu_khien]
        );

        for (const row of existingRows) {
            const rowStart = parseTimeToMinutes(row.thoi_gian_bat_dau);
            const rowEnd = parseTimeToMinutes(row.thoi_gian_ket_thuc);
            if (rowStart == null || rowEnd == null) continue;
            if (overlap(startMins, endMins, rowStart, rowEnd)) {
                return res.status(409).json({
                    error: `Lịch bị trùng với lịch #${row.ma_lich_trinh} (${row.thoi_gian_bat_dau}-${row.thoi_gian_ket_thuc})`
                });
            }
        }

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

router.post('/schedules/suggest', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    const { ao_id, ma_tb_dieu_khien } = req.body;
    if (!ao_id || !ma_tb_dieu_khien) {
        return res.status(400).json({ error: 'Thiếu ao_id hoặc ma_tb_dieu_khien' });
    }

    try {
        const [[metrics]] = await db.execute(
            `SELECT
                AVG(CASE WHEN cb.loai_cam_bien = 'TEMP' THEN dl.gia_tri END) AS avg_temp_24h,
                AVG(CASE WHEN cb.loai_cam_bien = 'LIGHT' THEN dl.gia_tri END) AS avg_light_24h
             FROM du_lieu_quan_trac dl
             JOIN cam_bien cb ON dl.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?
               AND dl.thoi_gian >= NOW() - INTERVAL 1 DAY`,
            [ao_id]
        );

        const avgTemp = Number(metrics?.avg_temp_24h || 26);
        const avgLight = Number(metrics?.avg_light_24h || 30);
        const duration = avgTemp > 28 || avgLight < 10 ? 30 : 20;

        const suggestions = [
            { start_time: '06:00', end_time: `06:${String(duration).padStart(2, '0')}`, reason: 'Buổi sáng, ưu tiên ổn định môi trường.' },
            { start_time: '12:00', end_time: `12:${String(duration).padStart(2, '0')}`, reason: 'Giữa ngày, bổ sung theo mức nhiệt và ánh sáng.' },
            { start_time: '18:00', end_time: `18:${String(duration).padStart(2, '0')}`, reason: 'Buổi chiều, giảm dao động môi trường ban đêm.' }
        ].map((item, idx) => ({
            id: `SUGGEST_${idx + 1}`,
            ao_id,
            ma_tb_dieu_khien,
            ...item
        }));

        res.json({
            status: 'success',
            metrics: { avg_temp_24h: avgTemp, avg_light_24h: avgLight },
            suggestions
        });
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

router.delete('/feeding-formulas/:id', requireAuth, requirePermission('device:status:update'), async (req, res) => {
    try {
        await db.execute('DELETE FROM cong_thuc_cho_an WHERE ma_cong_thuc = ?', [req.params.id]);
        res.json({ status: 'success', message: 'Đã xóa công thức' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

router.post('/feeding-history', async (req, res) => {
    let { ma_cong_thuc, ma_tb_dieu_khien, muc_do_them_an, bang_chung_hinh_anh } = req.body;

    try {
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
