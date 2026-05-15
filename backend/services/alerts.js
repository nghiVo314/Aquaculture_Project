const db = require('./db');

const ALERT_STATE_TABLE = 'alert_trang_thai';

const SEVERITY_RANK = {
    low: 1,
    medium: 2,
    warning: 3,
    critical: 4
};

function stateKey(sensorId, alertKind) {
    return `${String(sensorId || '')}:${String(alertKind || '').toUpperCase()}`;
}

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function parseNumeric(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value) {
    const parsed = parseNumeric(value);
    return parsed == null ? '--' : parsed.toFixed(1);
}

function getSeverityRank(severity) {
    return SEVERITY_RANK[String(severity || '').toLowerCase()] || 0;
}

function getSeverityLabel(severity) {
    const normalized = String(severity || '').toLowerCase();
    if (normalized === 'critical') return 'Nguy hiểm';
    if (normalized === 'warning') return 'Cảnh báo';
    if (normalized === 'medium') return 'Trung bình';
    return 'Thấp';
}

function normalizeAlertKind(alertKind, hasReading = true) {
    const normalized = String(alertKind || '').toUpperCase();
    if (normalized === 'OFFLINE' || normalized === 'MISSING_DATA') {
        return hasReading ? 'OFFLINE' : 'MISSING_DATA';
    }
    return normalized;
}

function buildThresholdSeverity({ value, min, max }) {
    const numericValue = parseNumeric(value);
    const numericMin = parseNumeric(min);
    const numericMax = parseNumeric(max);

    if (numericValue == null || numericMin == null || numericMax == null) {
        return 'medium';
    }

    const range = Math.max(Math.abs(numericMax - numericMin), 0.1);
    const deviation = numericValue < numericMin
        ? (numericMin - numericValue) / range
        : (numericValue - numericMax) / range;
    const normalizedDeviation = clamp01(deviation);

    if (normalizedDeviation >= 0.5) return 'critical';
    if (normalizedDeviation >= 0.25) return 'warning';
    if (normalizedDeviation >= 0.1) return 'medium';
    return 'low';
}

function buildOfflineSeverity({ offlineMinutes = 0, baseOfflineMinutes = 10, hasReading = true }) {
    if (!hasReading) {
        return 'warning';
    }

    const factor = baseOfflineMinutes > 0 ? offlineMinutes / baseOfflineMinutes : 1;
    if (factor >= 8) return 'critical';
    if (factor >= 4) return 'warning';
    if (factor >= 2) return 'medium';
    return 'low';
}

function classifyAlertSeverity({
    sensorType,
    warningType,
    value,
    min,
    max,
    offlineMinutes,
    baseOfflineMinutes,
    hasReading
}) {
    const normalizedKind = normalizeAlertKind(warningType, hasReading);
    if (normalizedKind === 'OFFLINE' || normalizedKind === 'MISSING_DATA') {
        return buildOfflineSeverity({ offlineMinutes, baseOfflineMinutes, hasReading });
    }

    return buildThresholdSeverity({ value, min, max, sensorType });
}

function buildAlertMessage({
    pondId,
    sensorId,
    sensorType,
    warningType,
    value,
    min,
    max,
    offlineMinutes,
    hasReading
}) {
    const normalizedSensorType = String(sensorType || sensorId || 'Cảm biến');
    const normalizedKind = normalizeAlertKind(warningType, hasReading);

    if (normalizedKind === 'MISSING_DATA') {
        return `${normalizedSensorType} tại ao ${pondId} chưa có dữ liệu đầu vào.`;
    }

    if (normalizedKind === 'OFFLINE') {
        return `${normalizedSensorType} tại ao ${pondId} mất kết nối ${offlineMinutes} phút.`;
    }

    if (normalizedKind === 'THRESHOLD_HIGH') {
        return `${normalizedSensorType} tại ao ${pondId} vượt ngưỡng trên: ${formatValue(value)} > ${formatValue(max)}.`;
    }

    if (normalizedKind === 'THRESHOLD_LOW') {
        return `${normalizedSensorType} tại ao ${pondId} thấp hơn ngưỡng dưới: ${formatValue(value)} < ${formatValue(min)}.`;
    }

    return `${normalizedSensorType} tại ao ${pondId} có biến động bất thường.`;
}

function buildAlertDescription({
    pondId,
    sensorId,
    sensorType,
    warningType,
    severity,
    value,
    min,
    max,
    offlineMinutes,
    hasReading,
    message
}) {
    const tokens = [
        `[POND:${pondId}]`,
        `[SENSOR:${sensorId}]`,
        `[SENSOR_TYPE:${String(sensorType || '').toUpperCase()}]`,
        `[TYPE:${normalizeAlertKind(warningType, hasReading)}]`,
        `[SEVERITY:${String(severity || '').toLowerCase()}]`
    ];

    if (Number.isFinite(parseNumeric(value))) {
        tokens.push(`[VALUE:${formatValue(value)}]`);
    }
    if (Number.isFinite(parseNumeric(min))) {
        tokens.push(`[MIN:${formatValue(min)}]`);
    }
    if (Number.isFinite(parseNumeric(max))) {
        tokens.push(`[MAX:${formatValue(max)}]`);
    }
    if (Number.isFinite(parseNumeric(offlineMinutes))) {
        tokens.push(`[OFFLINE_MINUTES:${offlineMinutes}]`);
    }

    return `${tokens.join(' ')} ${message}`.trim();
}

function parseAlertMeta(text = '') {
    const source = String(text || '');
    const readToken = (name) => {
        const match = source.match(new RegExp(`\\[${name}:([^\\]]+)\\]`, 'i'));
        return match?.[1] || '';
    };

    return {
        pondId: readToken('POND'),
        sensorId: readToken('SENSOR'),
        sensorType: readToken('SENSOR_TYPE'),
        alertKind: readToken('TYPE'),
        severity: String(readToken('SEVERITY') || '').toLowerCase(),
        value: parseNumeric(readToken('VALUE')),
        min: parseNumeric(readToken('MIN')),
        max: parseNumeric(readToken('MAX')),
        offlineMinutes: parseNumeric(readToken('OFFLINE_MINUTES')),
        message: source.replace(/\[[A-Z_]+:[^\]]+\]\s*/gi, '').trim()
    };
}

async function ensureAlertStateTable() {
    await db.execute(
        `CREATE TABLE IF NOT EXISTS ${ALERT_STATE_TABLE} (
            ma_thiet_bi varchar(50) NOT NULL,
            alert_kind varchar(30) NOT NULL,
            is_active tinyint(1) NOT NULL DEFAULT 0,
            previous_value float DEFAULT NULL,
            last_sensor_value float DEFAULT NULL,
            last_seen_at datetime DEFAULT NULL,
            last_alert_id bigint DEFAULT NULL,
            resolved_at datetime DEFAULT NULL,
            severity varchar(20) DEFAULT NULL,
            alert_message text DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (ma_thiet_bi, alert_kind),
            KEY idx_alert_kind (alert_kind),
            CONSTRAINT ${ALERT_STATE_TABLE}_ibfk_1 FOREIGN KEY (ma_thiet_bi) REFERENCES cam_bien (ma_thiet_bi) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
    );

    const [columns] = await db.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [ALERT_STATE_TABLE]
    );
    const existingColumns = new Set(columns.map((row) => row.COLUMN_NAME));

    if (existingColumns.has('last_value') && !existingColumns.has('last_sensor_value')) {
        await db.execute(
            `ALTER TABLE ${ALERT_STATE_TABLE}
             CHANGE COLUMN last_value last_sensor_value float DEFAULT NULL`
        );
        existingColumns.add('last_sensor_value');
    }

    if (!existingColumns.has('severity')) {
        await db.execute(`ALTER TABLE ${ALERT_STATE_TABLE} ADD COLUMN severity varchar(20) DEFAULT NULL`);
    }

    if (!existingColumns.has('alert_message')) {
        await db.execute(`ALTER TABLE ${ALERT_STATE_TABLE} ADD COLUMN alert_message text DEFAULT NULL`);
    }
}

async function tableExists(tableName) {
    const [rows] = await db.execute(
        `SELECT 1
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
         LIMIT 1`,
        [tableName]
    );
    return rows.length > 0;
}

async function buildAlertScope(user) {
    const params = [];
    const conditions = [];
    const hasPondWorkersTable = await tableExists('ao_nuoi_workers');

    if (!user?.roles?.includes('admin')) {
        const userId = String(user?.id || '').trim();
        if (!userId) {
            conditions.push('1 = 0');
        } else if (user.roles?.includes('manager')) {
            conditions.push('an.ma_khu_vuc IN (SELECT ma_khu_vuc FROM khu_vuc WHERE ma_nguoi_dung_quan_ly = ?)');
            params.push(userId);
        } else {
            if (hasPondWorkersTable) {
                conditions.push(`(
                    an.ma_nguoi_dung_phu_trach = ?
                    OR EXISTS (
                        SELECT 1
                        FROM ao_nuoi_workers aow_scope
                        WHERE aow_scope.ma_ao_nuoi = an.ma_ao_nuoi
                          AND aow_scope.ma_nguoi_dung = ?
                    )
                )`);
                params.push(userId, userId);
            } else {
                conditions.push('an.ma_nguoi_dung_phu_trach = ?');
                params.push(userId);
            }
        }
    }

    return {
        whereSql: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
        params
    };
}

function buildWorkerAssignmentJoin(hasPondWorkersTable) {
    return hasPondWorkersTable
        ? `
        LEFT JOIN (
            SELECT ranked.ma_ao_nuoi, ranked.ma_nguoi_dung
            FROM (
                SELECT
                    aow.ma_ao_nuoi,
                    aow.ma_nguoi_dung,
                    ROW_NUMBER() OVER (
                        PARTITION BY aow.ma_ao_nuoi
                        ORDER BY
                            CASE aow.vai_tro
                                WHEN 'MAINTENANCE' THEN 0
                                WHEN 'PRIMARY' THEN 1
                                ELSE 2
                            END,
                            aow.ngay_tao,
                            aow.id
                    ) AS rn
                FROM ao_nuoi_workers aow
            ) ranked
            WHERE ranked.rn = 1
        ) assigned_worker ON assigned_worker.ma_ao_nuoi = an.ma_ao_nuoi
        LEFT JOIN nguoi_dung worker
            ON worker.ma_nguoi_dung = COALESCE(assigned_worker.ma_nguoi_dung, an.ma_nguoi_dung_phu_trach)
        `
        : `
        LEFT JOIN nguoi_dung worker
            ON worker.ma_nguoi_dung = an.ma_nguoi_dung_phu_trach
        `;
}

async function listCurrentAlerts({ user, status, pondId, sort = 'urgent', days } = {}) {
    await ensureAlertStateTable();
    const hasPondWorkersTable = await tableExists('ao_nuoi_workers');
    const workerAssignmentJoin = buildWorkerAssignmentJoin(hasPondWorkersTable);

    const params = [];
    let query = `
        SELECT
            ats.ma_thiet_bi AS sensor_id,
            cb.loai_cam_bien AS sensor_type,
            ats.alert_kind,
            ats.severity,
            ats.alert_message,
            ats.previous_value,
            ats.last_sensor_value AS current_value,
            ats.last_seen_at,
            ats.updated_at AS changed_at,
            ats.last_alert_id AS ma_log,
            COALESCE(l.acknowledged, 0) AS acknowledged,
            l.mo_ta,
            COALESCE(l.thoi_gian_khoi_tao, ats.updated_at) AS thoi_gian_khoi_tao,
            an.ma_ao_nuoi,
            an.ma_khu_vuc,
            worker.ma_nguoi_dung AS worker_id,
            worker.ten_dang_nhap AS worker_name
        FROM ${ALERT_STATE_TABLE} ats
        JOIN cam_bien cb ON cb.ma_thiet_bi = ats.ma_thiet_bi
        JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = cb.ma_thiet_bi
        JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
        JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
        LEFT JOIN log_he_thong l ON l.ma_log = ats.last_alert_id
        ${workerAssignmentJoin}
        WHERE ats.is_active = 1
    `;

    if (pondId) {
        query += ' AND an.ma_ao_nuoi = ?';
        params.push(pondId);
    }

    if (status === 'unacknowledged') {
        query += ' AND COALESCE(l.acknowledged, 0) = 0';
    }

    if (Number.isFinite(days) && days > 0) {
        query += ' AND COALESCE(l.thoi_gian_khoi_tao, ats.updated_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        params.push(days);
    }

    const scope = await buildAlertScope(user);
    query += scope.whereSql;
    params.push(...scope.params);

    if (String(sort || '').toLowerCase() === 'newest') {
        query += ' ORDER BY COALESCE(l.thoi_gian_khoi_tao, ats.updated_at) DESC, ats.updated_at DESC';
    } else {
        query += `
            ORDER BY
                CASE ats.severity
                    WHEN 'critical' THEN 4
                    WHEN 'warning' THEN 3
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 1
                    ELSE 0
                END DESC,
                COALESCE(l.acknowledged, 0) ASC,
                COALESCE(l.thoi_gian_khoi_tao, ats.updated_at) DESC
        `;
    }

    const [rows] = await db.query(query, params);
    return rows.map((row) => ({
        ...row,
        severity: String(row.severity || parseAlertMeta(row.mo_ta).severity || 'medium').toLowerCase(),
        severity_rank: getSeverityRank(row.severity || parseAlertMeta(row.mo_ta).severity),
        severity_label: getSeverityLabel(row.severity || parseAlertMeta(row.mo_ta).severity),
        description: row.alert_message || parseAlertMeta(row.mo_ta).message || row.mo_ta,
        pond_id: row.ma_ao_nuoi,
        zone_id: row.ma_khu_vuc,
        alert_key: stateKey(row.sensor_id, row.alert_kind)
    }));
}

async function listAlertHistory({
    user,
    pondId,
    sensorId,
    status = 'all',
    sort = 'newest',
    days,
    limit = 200
} = {}) {
    await ensureAlertStateTable();

    const params = [];
    let query = `
        SELECT
            l.ma_log,
            l.acknowledged,
            l.mo_ta,
            l.thoi_gian_khoi_tao,
            l.ma_nguoi_dung_tao
        FROM log_he_thong l
        WHERE l.log_type = 'WARNING'
    `;

    if (Number.isFinite(days) && days > 0) {
        query += ' AND l.thoi_gian_khoi_tao >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        params.push(days);
    }

    if (status === 'active') {
        query += ' AND COALESCE(l.acknowledged, 0) = 0';
    } else if (status === 'resolved') {
        query += ' AND COALESCE(l.acknowledged, 0) = 1';
    }

    query += sort === 'oldest'
        ? ' ORDER BY l.thoi_gian_khoi_tao ASC'
        : ' ORDER BY l.thoi_gian_khoi_tao DESC';

    if (Number.isFinite(limit) && limit > 0) {
        query += ' LIMIT ?';
        params.push(limit);
    }

    const [rows] = await db.query(query, params);
    const parsedRows = rows
        .map((row) => ({ ...row, meta: parseAlertMeta(row.mo_ta) }))
        .filter((row) => row.meta.sensorId);

    const sensorIds = [...new Set(parsedRows.map((row) => row.meta.sensorId))];
    if (sensorIds.length === 0) {
        return [];
    }

    const placeholders = sensorIds.map(() => '?').join(', ');
    const hasPondWorkersTable = await tableExists('ao_nuoi_workers');
    const workerAssignmentJoin = buildWorkerAssignmentJoin(hasPondWorkersTable);

    const [deviceRows] = await db.query(
        `
        SELECT
            cb.ma_thiet_bi AS sensor_id,
            cb.loai_cam_bien AS sensor_type,
            tbtb.ma_tram,
            tbtb.trang_thai AS sensor_status,
            tb.trang_thai_cloud,
            an.ma_ao_nuoi,
            an.ma_khu_vuc,
            kv.loai_thuy_san,
            worker.ma_nguoi_dung AS worker_id,
            worker.ten_dang_nhap AS worker_name,
            rd.ma_tb_dieu_khien AS linked_device_id,
            ctrl.loai_thiet_bi AS linked_device_type
        FROM cam_bien cb
        JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = cb.ma_thiet_bi
        JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
        JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
        LEFT JOIN khu_vuc kv ON kv.ma_khu_vuc = an.ma_khu_vuc
        LEFT JOIN rule_dieu_khien rd ON rd.ma_cam_bien = cb.ma_thiet_bi
        LEFT JOIN thiet_bi_dieu_khien ctrl ON ctrl.ma_thiet_bi = rd.ma_tb_dieu_khien
        ${workerAssignmentJoin}
        WHERE cb.ma_thiet_bi IN (${placeholders})
        `,
        sensorIds
    );

    const scope = await buildAlertScope(user);
    const [allowedRows] = await db.query(
        `
        SELECT DISTINCT cb.ma_thiet_bi AS sensor_id
        FROM cam_bien cb
        JOIN thiet_bi_tai_bien tbtb ON tbtb.ma_thiet_bi = cb.ma_thiet_bi
        JOIN tram_bien tb ON tb.ma_tram = tbtb.ma_tram
        JOIN ao_nuoi an ON an.ma_ao_nuoi = tb.ma_ao_nuoi
        WHERE cb.ma_thiet_bi IN (${placeholders})
        ${scope.whereSql}
        `,
        [...sensorIds, ...scope.params]
    );
    const allowedSensorIds = new Set(allowedRows.map((row) => row.sensor_id));
    const deviceMap = new Map(deviceRows.map((row) => [row.sensor_id, row]));

    return parsedRows
        .filter((row) => allowedSensorIds.has(row.meta.sensorId))
        .filter((row) => !pondId || deviceMap.get(row.meta.sensorId)?.ma_ao_nuoi === pondId)
        .filter((row) => !sensorId || row.meta.sensorId === sensorId)
        .map((row) => {
            const detail = deviceMap.get(row.meta.sensorId) || {};
            const severity = String(row.meta.severity || 'medium').toLowerCase();
            return {
                ma_log: row.ma_log,
                acknowledged: Number(row.acknowledged) === 1,
                thoi_gian_khoi_tao: row.thoi_gian_khoi_tao,
                sensor_id: row.meta.sensorId,
                sensor_type: detail.sensor_type || row.meta.sensorType,
                alert_kind: row.meta.alertKind,
                severity,
                severity_rank: getSeverityRank(severity),
                severity_label: getSeverityLabel(severity),
                description: row.meta.message || row.mo_ta,
                current_value: row.meta.value,
                min_value: row.meta.min,
                max_value: row.meta.max,
                offline_minutes: row.meta.offlineMinutes,
                pond_id: detail.ma_ao_nuoi || row.meta.pondId,
                zone_id: detail.ma_khu_vuc || '',
                station_id: detail.ma_tram || '',
                worker_id: detail.worker_id || '',
                worker_name: detail.worker_name || '',
                linked_device_id: detail.linked_device_id || '',
                linked_device_type: detail.linked_device_type || '',
                trang_thai_cloud: detail.trang_thai_cloud || '',
                sensor_status: detail.sensor_status || '',
                history_key: `${row.meta.sensorId}:${row.ma_log}`
            };
        });
}

module.exports = {
    ALERT_STATE_TABLE,
    SEVERITY_RANK,
    stateKey,
    parseNumeric,
    formatValue,
    getSeverityRank,
    getSeverityLabel,
    normalizeAlertKind,
    classifyAlertSeverity,
    buildAlertMessage,
    buildAlertDescription,
    parseAlertMeta,
    ensureAlertStateTable,
    tableExists,
    buildAlertScope,
    listCurrentAlerts,
    listAlertHistory
};
