const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth, requirePermission } = require('../middlewares/rbac');
//flag khi có thây đổi
let needsReload = false;

async function checkPondOwnership(connection, pondId, userId) {
    const [result] = await connection.execute(`
        SELECT a.ma_ao_nuoi
        FROM ao_nuoi a
        JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
        WHERE a.ma_ao_nuoi = ?
          AND k.ma_nguoi_dung_quan_ly = ?
        LIMIT 1
    `, [pondId, userId]);

    if (result.length === 0) {
        return {
            authorized: false,
            errorMessage: 'Bạn không có quyền sửa cấu hình ao này (ao không thuộc khu vực quản lý của bạn)'
        };
    }

    return { authorized: true };
}

async function ensureThresholdHistoryTable(connection = db) {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS lich_su_chinh_nguong (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ma_ao_nuoi VARCHAR(50) NOT NULL,
            ma_rule VARCHAR(50) NOT NULL,
            loai_cam_bien VARCHAR(50) NOT NULL,
            ma_cam_bien VARCHAR(50) NOT NULL,
            ma_tb_dieu_khien VARCHAR(50) NOT NULL,
            vi_tri_thiet_bi VARCHAR(100) NOT NULL,
            mo_ta VARCHAR(255) NOT NULL,
            nguoi_sua VARCHAR(100) NOT NULL,
            da_sua TINYINT(1) NOT NULL DEFAULT 1,
            min_value DECIMAL(10,2) NOT NULL,
            max_value DECIMAL(10,2) NOT NULL,
            thoi_gian TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ao_thoi_gian (ma_ao_nuoi, thoi_gian),
            INDEX idx_rule (ma_rule)
        )
    `);

    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'lich_su_chinh_nguong'`
    );
    const existingColumns = new Set(columns.map((row) => row.COLUMN_NAME));

    const columnDefinitions = [
        ['ma_rule', 'VARCHAR(50) NULL DEFAULT NULL'],
        ['loai_cam_bien', 'VARCHAR(50) NULL DEFAULT NULL'],
        ['ma_cam_bien', 'VARCHAR(50) NULL DEFAULT NULL'],
        ['ma_tb_dieu_khien', 'VARCHAR(50) NULL DEFAULT NULL'],
        ['low_action', 'VARCHAR(20) NULL DEFAULT NULL'],
        ['high_action', 'VARCHAR(20) NULL DEFAULT NULL'],
        ['vi_tri_thiet_bi', 'VARCHAR(100) NULL DEFAULT NULL'],
        ['mo_ta', 'VARCHAR(255) NULL DEFAULT NULL'],
        ['nguoi_sua', 'VARCHAR(100) NULL DEFAULT NULL'],
        ['da_sua', 'TINYINT(1) NOT NULL DEFAULT 1'],
        ['min_value', 'DECIMAL(10,2) NULL DEFAULT NULL'],
        ['max_value', 'DECIMAL(10,2) NULL DEFAULT NULL'],
        ['thoi_gian', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP']
    ];

    for (const [columnName, definition] of columnDefinitions) {
        if (!existingColumns.has(columnName)) {
            await connection.execute(`ALTER TABLE lich_su_chinh_nguong ADD COLUMN ${columnName} ${definition}`);
        }
    }
}

async function ensureRuleActionColumns(connection = db) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'rule_dieu_khien'`
    );
    const existingColumns = new Set(columns.map((row) => row.COLUMN_NAME));

    if (!existingColumns.has('low_action')) {
        await connection.execute(
            `ALTER TABLE rule_dieu_khien
             ADD COLUMN low_action VARCHAR(20) NULL DEFAULT 'HOAT_DONG' AFTER max_value`
        );
    }

    if (!existingColumns.has('high_action')) {
        await connection.execute(
            `ALTER TABLE rule_dieu_khien
             ADD COLUMN high_action VARCHAR(20) NULL DEFAULT 'HOAT_DONG' AFTER low_action`
        );
    }
}

async function ensurePondWorkerColumn(connection = db) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ao_nuoi'`
    );
    const existingColumns = new Set(columns.map((row) => row.COLUMN_NAME));

    if (!existingColumns.has('ma_nguoi_dung_phu_trach')) {
        await connection.execute(
            `ALTER TABLE ao_nuoi ADD COLUMN ma_nguoi_dung_phu_trach varchar(50) DEFAULT NULL`
        );
    }

    const [keys] = await connection.execute(
        `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ao_nuoi'
           AND COLUMN_NAME = 'ma_nguoi_dung_phu_trach'`
    );
    const hasForeignKey = keys.some((row) => row.REFERENCED_TABLE_NAME === 'nguoi_dung');

    if (!hasForeignKey) {
        try {
            await connection.execute(
                `ALTER TABLE ao_nuoi
                 ADD CONSTRAINT ao_nuoi_ibfk_worker
                 FOREIGN KEY (ma_nguoi_dung_phu_trach) REFERENCES nguoi_dung (ma_nguoi_dung) ON DELETE SET NULL`
            );
        } catch (error) {
            if (!String(error.message || '').includes('Duplicate foreign key constraint')) {
                throw error;
            }
        }
    }

    try {
        await connection.execute(
            `ALTER TABLE ao_nuoi ADD UNIQUE KEY uniq_ao_worker (ma_nguoi_dung_phu_trach)`
        );
    } catch (error) {
        if (!String(error.message || '').includes('Duplicate key name')) {
            throw error;
        }
    }
}

router.get('/', requireAuth, async (req, res) => {
    try {
        await ensurePondWorkerColumn(db);
        const [rows] = await db.execute(`
            SELECT a.*, t.ma_tram, t.trang_thai_cloud, nd.ten_dang_nhap AS nguoi_phu_trach
            FROM ao_nuoi a
            LEFT JOIN tram_bien t ON a.ma_ao_nuoi = t.ma_ao_nuoi
            LEFT JOIN nguoi_dung nd ON nd.ma_nguoi_dung = a.ma_nguoi_dung_phu_trach
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// THÊM AO - Chỉ dành cho user có quyền 'pond:create'
router.post('/', requireAuth, requirePermission('pond:create'), async (req, res) => {
    let { ma_ao_nuoi, ma_khu_vuc, dien_tich, ma_nguoi_dung_phu_trach } = req.body; 
    const connection = await db.getConnection(); // Sử dụng connection riêng để dùng Transaction
    
    try {
        await ensurePondWorkerColumn(connection);
        const safeZoneId = String(ma_khu_vuc || '').trim();
        const safeArea = Number(dien_tich);
        const safeWorkerId = ma_nguoi_dung_phu_trach ? String(ma_nguoi_dung_phu_trach).trim() : null;

        if (!safeZoneId) {
            return res.status(400).json({ status: 'error', message: 'Thiếu mã khu vực' });
        }

        if (!Number.isFinite(safeArea) || safeArea <= 0) {
            return res.status(400).json({ status: 'error', message: 'Diện tích ao không hợp lệ' });
        }

        if (safeWorkerId) {
            const [workerRows] = await connection.execute(
                `SELECT u.ma_nguoi_dung
                 FROM nguoi_dung u
                 INNER JOIN nguoi_dung_role ur ON ur.ma_nguoi_dung = u.ma_nguoi_dung
                 INNER JOIN role r ON r.ma_role = ur.ma_role
                 WHERE u.ma_nguoi_dung = ? AND (r.ma_role = 'worker' OR LOWER(r.role_name) LIKE '%công nhân%')
                 LIMIT 1`,
                [safeWorkerId]
            );
            if (workerRows.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Người phụ trách phải là worker hợp lệ' });
            }

            const [existingWorkerPond] = await connection.execute(
                `SELECT ma_ao_nuoi FROM ao_nuoi WHERE ma_nguoi_dung_phu_trach = ? LIMIT 1`,
                [safeWorkerId]
            );
            if (existingWorkerPond.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: `Worker này đã phụ trách ao ${existingWorkerPond[0].ma_ao_nuoi}. Mỗi worker chỉ được gán 1 ao.`
                });
            }
        }

        await connection.beginTransaction();

        // 1. Kiểm tra giới hạn ao
        const [result] = await connection.execute(
            'SELECT COUNT(*) as total FROM ao_nuoi WHERE ma_khu_vuc = ?', 
            [safeZoneId]
        );
        if (result[0].total >= 10) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'Khu vực này đã đạt tối đa 10 ao nuôi!' });
        }

        // 2. Thêm ao nuôi theo mã khu vực + số thứ tự tăng dần: KV3_A001, KV3_A002...
        if (!ma_ao_nuoi) {
            const zonePrefix = safeZoneId.replace(/[^a-zA-Z0-9]/g, '');
            const [[row]] = await connection.execute(
                `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ma_ao_nuoi, 'A', -1) AS UNSIGNED)), 0) as maxid
                 FROM ao_nuoi
                 WHERE ma_khu_vuc = ?`,
                [safeZoneId]
            );
            const nextId = (row.maxid || 0) + 1;
            ma_ao_nuoi = `${zonePrefix}_A${String(nextId).padStart(3, '0')}`;
        }

        const safePondId = String(ma_ao_nuoi || '').trim();

        await connection.execute(
            'INSERT INTO ao_nuoi (ma_ao_nuoi, ma_khu_vuc, dien_tich, ma_nguoi_dung_phu_trach) VALUES (?, ?, ?, ?)',
            [safePondId, safeZoneId, safeArea, safeWorkerId]
        );

        // 3. Tự động tạo 1 Trạm (Gateway) cho ao này
        const ma_tram = `TRAM_${safePondId}`;
        await connection.execute(
            'INSERT INTO tram_bien (ma_tram, ma_ao_nuoi, trang_thai_cloud) VALUES (?, ?, ?)',
            [ma_tram, safePondId, 'CONNECTED']
        );

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
        await ensurePondWorkerColumn(db);
        await ensureRuleActionColumns(db);

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
                r.ma_tb_dieu_khien,
                COALESCE(r.low_action, 'HOAT_DONG') AS low_action,
                COALESCE(r.high_action, 'HOAT_DONG') AS high_action,
                dk.loai_thiet_bi AS loai_thiet_bi_dieu_khien,
                (SELECT gia_tri
                 FROM du_lieu_quan_trac
                 WHERE ma_cam_bien = cb.ma_thiet_bi
                 ORDER BY thoi_gian DESC
                 LIMIT 1) AS latest_value
             FROM cam_bien cb
             LEFT JOIN rule_dieu_khien r ON r.ma_cam_bien = cb.ma_thiet_bi
             LEFT JOIN thiet_bi_dieu_khien dk ON dk.ma_thiet_bi = r.ma_tb_dieu_khien
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?
             ORDER BY cb.loai_cam_bien, cb.ma_thiet_bi`,
            [req.params.ao_id]
        );

        const [availableActuators] = await db.execute(
            `SELECT
                dk.ma_thiet_bi,
                dk.loai_thiet_bi,
                tbtb.trang_thai
             FROM thiet_bi_dieu_khien dk
             JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = dk.ma_thiet_bi
             JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
             WHERE tb.ma_ao_nuoi = ?
             ORDER BY dk.loai_thiet_bi, dk.ma_thiet_bi`,
            [req.params.ao_id]
        );

        res.json({
            ao_id: req.params.ao_id,
            che_do: pond?.che_do || 'AUTO',
            configs,
            available_actuators: availableActuators
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SỬA CẤU HÌNH AO - Chỉ dành cho user có quyền 'pond:update:config'
router.put('/legacy/:ao_id/config', requireAuth, requirePermission('pond:update:config'), async (req, res) => {
    const { LoaiCamBien, min_value, max_value } = req.body;
    const connection = await db.getConnection();
    try {
        await ensureThresholdHistoryTable(connection);
        const ownershipCheck = await checkPondOwnership(connection, req.params.ao_id, req.user.id);
        if (!ownershipCheck.authorized) {
            return res.status(403).json({
                status: 'error',
                message: ownershipCheck.errorMessage
            });
        }

        await connection.beginTransaction();

        // Lấy rule hiện tại để cập nhật và ghi lịch sử cùng lúc
        const [matchedRules] = await connection.execute(
            `SELECT r.ma_rule, cb.loai_cam_bien, cb.ma_thiet_bi AS ma_cam_bien,
                    dk.ma_thiet_bi AS ma_tb_dieu_khien, dk.loai_thiet_bi,
                    tb.ma_tram
             FROM rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             LEFT JOIN thiet_bi_dieu_khien dk ON r.ma_tb_dieu_khien = dk.ma_thiet_bi
             WHERE tb.ma_ao_nuoi = ? AND cb.loai_cam_bien = ?
             LIMIT 1`,
            [req.params.ao_id, LoaiCamBien]
        );

        if (matchedRules.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy rule cho cảm biến này trong ao' });
        }

        const rule = matchedRules[0];
        const actorName = req.user?.username || req.user?.TenDangNhap || req.user?.id || 'system';
        const deviceName = rule.loai_thiet_bi || rule.ma_tb_dieu_khien;
        const deviceLocation = rule.ma_tram || 'unknown';
        const description = `${rule.loai_cam_bien} đổi ngưỡng từ ${Number(rule.min_value || 0)}-${Number(rule.max_value || 0)} sang ${Number(min_value)}-${Number(max_value)}`;

        // Cập nhật rule
        const [result] = await connection.execute(
            `UPDATE rule_dieu_khien
             SET min_value = ?, max_value = ?
             WHERE ma_rule = ?`,
            [min_value, max_value, rule.ma_rule]
        );
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy rule cho cảm biến này trong ao' });
        }

        await connection.execute(
            `INSERT INTO lich_su_chinh_nguong
                (ma_ao_nuoi, ma_rule, loai_cam_bien, ma_cam_bien, ma_tb_dieu_khien, vi_tri_thiet_bi, mo_ta, nguoi_sua, da_sua, min_value, max_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                req.params.ao_id,
                rule.ma_rule,
                rule.loai_cam_bien,
                rule.ma_cam_bien,
                rule.ma_tb_dieu_khien,
                deviceLocation,
                description,
                actorName,
                min_value,
                max_value
            ]
        );

        await connection.commit();
        res.json({ status: 'updated' });
    } catch (error) {
        try { await connection.rollback(); } catch (_) {}
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Lấy lịch sử chỉnh ngưỡng của ao
router.put('/:ao_id/config', requireAuth, requirePermission('pond:update:config'), async (req, res) => {
    const { ma_rule, ma_cam_bien, ma_tb_dieu_khien, LoaiCamBien, min_value, max_value, low_action, high_action } = req.body;
    const connection = await db.getConnection();
    try {
        await ensureThresholdHistoryTable(connection);
        await ensureRuleActionColumns(connection);
        const ownershipCheck = await checkPondOwnership(connection, req.params.ao_id, req.user.id);
        if (!ownershipCheck.authorized) {
            return res.status(403).json({
                status: 'error',
                message: ownershipCheck.errorMessage
            });
        }

        const normalizedLowAction = String(low_action || 'HOAT_DONG').trim().toUpperCase();
        const normalizedHighAction = String(high_action || 'HOAT_DONG').trim().toUpperCase();
        const validActions = new Set(['HOAT_DONG', 'TAT']);
        if (!validActions.has(normalizedLowAction) || !validActions.has(normalizedHighAction)) {
            return res.status(400).json({ status: 'error', message: 'Hanh dong rule chi duoc la HOAT_DONG hoac TAT' });
        }

        const parsedMin = Number(min_value);
        const parsedMax = Number(max_value);
        if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMin >= parsedMax) {
            return res.status(400).json({ status: 'error', message: 'Nguong min/max khong hop le' });
        }

        if (!ma_tb_dieu_khien) {
            return res.status(400).json({ status: 'error', message: 'Thieu thiet bi dieu khien cho rule' });
        }

        await connection.beginTransaction();

        const [sensorRows] = await connection.execute(
            `SELECT
                cb.ma_thiet_bi AS ma_cam_bien,
                cb.loai_cam_bien,
                tb.ma_tram
             FROM cam_bien cb
             JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = cb.ma_thiet_bi
             JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
             WHERE tb.ma_ao_nuoi = ?
               AND (? IS NULL OR cb.ma_thiet_bi = ?)
               AND (? IS NULL OR cb.loai_cam_bien = ?)
             ORDER BY cb.ma_thiet_bi
             LIMIT 1`,
            [req.params.ao_id, ma_cam_bien || null, ma_cam_bien || null, LoaiCamBien || null, LoaiCamBien || null]
        );

        if (sensorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Khong tim thay cam bien trong ao de cau hinh rule' });
        }

        const sensor = sensorRows[0];

        const [[actuator]] = await connection.execute(
            `SELECT
                dk.ma_thiet_bi,
                dk.loai_thiet_bi
             FROM thiet_bi_dieu_khien dk
             JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = dk.ma_thiet_bi
             JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
             WHERE tb.ma_ao_nuoi = ? AND dk.ma_thiet_bi = ?
             LIMIT 1`,
            [req.params.ao_id, ma_tb_dieu_khien]
        );

        if (!actuator) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Thiet bi dieu khien khong thuoc ao nay hoac khong ton tai' });
        }

        const [matchedRules] = await connection.execute(
            `SELECT
                r.ma_rule,
                cb.loai_cam_bien,
                cb.ma_thiet_bi AS ma_cam_bien,
                r.min_value,
                r.max_value,
                COALESCE(r.low_action, 'HOAT_DONG') AS low_action,
                COALESCE(r.high_action, 'HOAT_DONG') AS high_action,
                r.ma_tb_dieu_khien,
                tb.ma_tram
             FROM rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?
               AND cb.ma_thiet_bi = ?
               AND (? IS NULL OR r.ma_rule = ?)
             LIMIT 1`,
            [req.params.ao_id, sensor.ma_cam_bien, ma_rule || null, ma_rule || null]
        );

        const rule = matchedRules[0] || null;
        const actorName = req.user?.username || req.user?.TenDangNhap || req.user?.id || 'system';
        const deviceLocation = sensor.ma_tram || 'unknown';
        const finalRuleId = rule?.ma_rule || `RULE_${sensor.ma_cam_bien}`;
        const previousRangeText = rule
            ? `${Number(rule.min_value || 0)}-${Number(rule.max_value || 0)}`
            : 'chua cau hinh';
        const previousActionText = rule
            ? `< min => ${rule.low_action}, > max => ${rule.high_action}, thiet bi => ${rule.ma_tb_dieu_khien}`
            : 'chua cau hinh';
        const description = `${sensor.loai_cam_bien} doi nguong tu ${previousRangeText} sang ${parsedMin}-${parsedMax}; ${previousActionText}; moi: < min => ${normalizedLowAction}, > max => ${normalizedHighAction}, thiet bi => ${actuator.ma_thiet_bi}`;

        if (rule) {
            await connection.execute(
                `UPDATE rule_dieu_khien
                 SET ma_tb_dieu_khien = ?, min_value = ?, max_value = ?, low_action = ?, high_action = ?
                 WHERE ma_rule = ?`,
                [actuator.ma_thiet_bi, parsedMin, parsedMax, normalizedLowAction, normalizedHighAction, rule.ma_rule]
            );
        } else {
            await connection.execute(
                `INSERT INTO rule_dieu_khien
                    (ma_rule, ma_cam_bien, ma_tb_dieu_khien, min_value, max_value, low_action, high_action)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [finalRuleId, sensor.ma_cam_bien, actuator.ma_thiet_bi, parsedMin, parsedMax, normalizedLowAction, normalizedHighAction]
            );
        }

        await connection.execute(
            `INSERT INTO lich_su_chinh_nguong
                (ma_ao_nuoi, ma_rule, loai_cam_bien, ma_cam_bien, ma_tb_dieu_khien, low_action, high_action, vi_tri_thiet_bi, mo_ta, nguoi_sua, da_sua, min_value, max_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                req.params.ao_id,
                finalRuleId,
                sensor.loai_cam_bien,
                sensor.ma_cam_bien,
                actuator.ma_thiet_bi,
                normalizedLowAction,
                normalizedHighAction,
                deviceLocation,
                description,
                actorName,
                parsedMin,
                parsedMax
            ]
        );

        await connection.commit();
        res.json({ status: 'updated', ma_rule: finalRuleId });
    } catch (error) {
        try { await connection.rollback(); } catch (_) {}
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

router.get('/:ao_id/config/history', requireAuth, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await ensureThresholdHistoryTable(connection);

        const [rows] = await connection.execute(
            `SELECT
                id,
                ma_ao_nuoi,
                ma_rule,
                loai_cam_bien,
                ma_cam_bien,
                ma_tb_dieu_khien,
                low_action,
                high_action,
                vi_tri_thiet_bi,
                mo_ta,
                nguoi_sua,
                da_sua,
                min_value,
                max_value,
                thoi_gian
             FROM lich_su_chinh_nguong
             WHERE ma_ao_nuoi = ?
             ORDER BY thoi_gian DESC, id DESC`,
            [req.params.ao_id]
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// CẬP NHẬT THÔNG TIN AO - Chỉ dành cho user có quyền 'pond:update'
router.put('/:id', requireAuth, requirePermission('pond:update'), async (req, res) => {
    const { dien_tich, ma_nguoi_dung_phu_trach } = req.body;
    try {
        await ensurePondWorkerColumn(db);
        const safeWorkerId = ma_nguoi_dung_phu_trach ? String(ma_nguoi_dung_phu_trach).trim() : null;
        if (safeWorkerId) {
            const [workerRows] = await db.execute(
                `SELECT u.ma_nguoi_dung
                 FROM nguoi_dung u
                 INNER JOIN nguoi_dung_role ur ON ur.ma_nguoi_dung = u.ma_nguoi_dung
                 INNER JOIN role r ON r.ma_role = ur.ma_role
                 WHERE u.ma_nguoi_dung = ? AND (r.ma_role = 'worker' OR LOWER(r.role_name) LIKE '%công nhân%')
                 LIMIT 1`,
                [safeWorkerId]
            );
            if (workerRows.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Người phụ trách phải là worker hợp lệ' });
            }

            const [existingWorkerPond] = await db.execute(
                `SELECT ma_ao_nuoi FROM ao_nuoi WHERE ma_nguoi_dung_phu_trach = ? AND ma_ao_nuoi <> ? LIMIT 1`,
                [safeWorkerId, req.params.id]
            );
            if (existingWorkerPond.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    message: `Worker này đã phụ trách ao ${existingWorkerPond[0].ma_ao_nuoi}. Mỗi worker chỉ được gán 1 ao.`
                });
            }
        }

        await db.execute(
            'UPDATE ao_nuoi SET dien_tich = ?, ma_nguoi_dung_phu_trach = ? WHERE ma_ao_nuoi = ?',
            [dien_tich, safeWorkerId, req.params.id]
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

// GET workers for a pond
router.get('/:pond_id/workers', requireAuth, async (req, res) => {
    try {
        const [workers] = await db.execute(`
            SELECT
                u.ma_nguoi_dung,
                u.ten_dang_nhap,
                COALESCE(aow.vai_tro, 'PRIMARY') AS vai_tro,
                aow.ngay_tao
            FROM ao_nuoi_workers aow
            JOIN nguoi_dung u ON aow.ma_nguoi_dung = u.ma_nguoi_dung
            WHERE aow.ma_ao_nuoi = ?
            ORDER BY aow.vai_tro, u.ten_dang_nhap
        `, [req.params.pond_id]);

        res.json(workers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: assign worker to pond
router.post('/:pond_id/workers', requireAuth, requirePermission('pond:manage:workers'), async (req, res) => {
    const { ma_nguoi_dung, vai_tro } = req.body;
    const connection = await db.getConnection();

    try {
        if (!ma_nguoi_dung) {
            return res.status(400).json({ error: 'Thiếu ma_nguoi_dung' });
        }

        const ownershipCheck = await checkPondOwnership(connection, req.params.pond_id, req.user.id);
        if (!ownershipCheck.authorized) {
            return res.status(403).json({ status: 'error', message: ownershipCheck.errorMessage });
        }

        const [workerCheck] = await connection.execute(`
            SELECT u.ma_nguoi_dung
            FROM nguoi_dung u
            INNER JOIN nguoi_dung_role ur ON ur.ma_nguoi_dung = u.ma_nguoi_dung
            INNER JOIN role r ON r.ma_role = ur.ma_role
            WHERE u.ma_nguoi_dung = ?
              AND (r.ma_role = 'worker' OR LOWER(r.role_name) LIKE '%công nhân%')
            LIMIT 1
        `, [ma_nguoi_dung]);

        if (workerCheck.length === 0) {
            return res.status(400).json({ error: 'Người này không có vai trò Worker' });
        }

        const [existing] = await connection.execute(`
            SELECT id FROM ao_nuoi_workers
            WHERE ma_ao_nuoi = ? AND ma_nguoi_dung = ?
        `, [req.params.pond_id, ma_nguoi_dung]);

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Worker này đã được gán vào ao' });
        }

        await connection.execute(`
            INSERT INTO ao_nuoi_workers (ma_ao_nuoi, ma_nguoi_dung, vai_tro)
            VALUES (?, ?, ?)
        `, [req.params.pond_id, ma_nguoi_dung, vai_tro || 'PRIMARY']);

        res.json({ status: 'success', message: 'Đã gán worker cho ao' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// DELETE: remove worker from pond
router.delete('/:pond_id/workers/:worker_id', requireAuth, requirePermission('pond:manage:workers'), async (req, res) => {
    const connection = await db.getConnection();

    try {
        const ownershipCheck = await checkPondOwnership(connection, req.params.pond_id, req.user.id);
        if (!ownershipCheck.authorized) {
            return res.status(403).json({ status: 'error', message: ownershipCheck.errorMessage });
        }

        const [result] = await connection.execute(`
            DELETE FROM ao_nuoi_workers
            WHERE ma_ao_nuoi = ? AND ma_nguoi_dung = ?
        `, [req.params.pond_id, req.params.worker_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Không tìm thấy worker assignment' });
        }

        res.json({ status: 'success', message: 'Đã xóa worker khỏi ao' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// PUT: update worker role on pond
router.put('/:pond_id/workers/:worker_id', requireAuth, requirePermission('pond:manage:workers'), async (req, res) => {
    const { vai_tro } = req.body;
    const connection = await db.getConnection();

    try {
        if (!vai_tro || !['PRIMARY', 'MAINTENANCE', 'ASSISTANT'].includes(vai_tro)) {
            return res.status(400).json({ error: 'Vai trò không hợp lệ (PRIMARY, MAINTENANCE, ASSISTANT)' });
        }

        const ownershipCheck = await checkPondOwnership(connection, req.params.pond_id, req.user.id);
        if (!ownershipCheck.authorized) {
            return res.status(403).json({ status: 'error', message: ownershipCheck.errorMessage });
        }

        const [result] = await connection.execute(`
            UPDATE ao_nuoi_workers
            SET vai_tro = ?
            WHERE ma_ao_nuoi = ? AND ma_nguoi_dung = ?
        `, [vai_tro, req.params.pond_id, req.params.worker_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Không tìm thấy worker assignment' });
        }

        res.json({ status: 'success', message: 'Đã cập nhật vai trò worker' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
module.exports.ensurePondWorkerColumn = ensurePondWorkerColumn;
