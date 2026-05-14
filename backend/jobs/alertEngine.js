const db = require('../services/db');

const DEFAULT_INTERVAL_MS = Number(process.env.ALERT_ENGINE_INTERVAL_MS || 15000);
const OFFLINE_MINUTES = Number(process.env.SENSOR_OFFLINE_MINUTES || 10);
const ALERT_STATE_TABLE = 'alert_trang_thai';

const alertStateCache = new Map();
let initPromise = null;
let cycleRunning = false;

function stateKey(sensorId, warningType) {
    return `${String(sensorId || '')}:${String(warningType || '').toUpperCase()}`;
}

function parseAlertMeta(text = '') {
    const source = String(text || '');
    const sensorMatch = source.match(/\[SENSOR:([^\]]+)\]/i);
    const pondMatch = source.match(/\[POND:([^\]]+)\]/i);
    const typeMatch = source.match(/\[TYPE:([^\]]+)\]/i);
    const valueMatch = source.match(/\bvalue=([\-0-9.]+)/i);

    return {
        pondId: pondMatch?.[1] || '',
        sensorId: sensorMatch?.[1] || '',
        warningType: (typeMatch?.[1] || '').toUpperCase(),
        currentValue: valueMatch?.[1] || ''
    };
}

function classifySeverity({ sensorType, warningType, value, min, max }) {
    const sensor = String(sensorType || '').toUpperCase();
    const type = String(warningType || '').toUpperCase();

    if (type === 'OFFLINE' || type === 'MISSING_DATA') {
        return 'critical';
    }

    if (sensor === 'TEMP') {
        if (type === 'THRESHOLD_HIGH') return 'critical';
        if (type === 'THRESHOLD_LOW') return 'warning';
    }

    if (sensor === 'DO' || sensor === 'OXYGEN') {
        return 'critical';
    }

    if (sensor === 'PH') {
        return 'warning';
    }

    if (sensor === 'LIGHT' || sensor === 'SALINITY') {
        return 'warning';
    }

    const numericValue = Number(value);
    const numericMin = Number(min);
    const numericMax = Number(max);
    if (Number.isFinite(numericValue) && Number.isFinite(numericMin) && Number.isFinite(numericMax)) {
        const range = Math.max(Math.abs(numericMax - numericMin), 0.1);
        const deviation = numericValue < numericMin
            ? (numericMin - numericValue) / range
            : (numericValue - numericMax) / range;

        if (deviation >= 0.35) return 'critical';
        if (deviation >= 0.15) return 'warning';
    }

    return 'caution';
}

async function ensureAlertStateTable() {
    if (!initPromise) {
        initPromise = db.execute(
            `CREATE TABLE IF NOT EXISTS ${ALERT_STATE_TABLE} (
                ma_thiet_bi varchar(50) NOT NULL,
                alert_kind varchar(30) NOT NULL,
                is_active tinyint(1) NOT NULL DEFAULT 0,
                previous_value float DEFAULT NULL,
                last_sensor_value float DEFAULT NULL,
                last_seen_at datetime DEFAULT NULL,
                last_alert_id bigint DEFAULT NULL,
                resolved_at datetime DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ma_thiet_bi, alert_kind),
                KEY idx_alert_kind (alert_kind),
                CONSTRAINT ${ALERT_STATE_TABLE}_ibfk_1 FOREIGN KEY (ma_thiet_bi) REFERENCES cam_bien (ma_thiet_bi) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
        );
    }

    await initPromise;

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
    }

    return true;
}

async function getAlertState(sensorId, alertKind) {
    await ensureAlertStateTable();
    const key = stateKey(sensorId, alertKind);
    if (alertStateCache.has(key)) {
        return alertStateCache.get(key);
    }

    const [rows] = await db.execute(
        `SELECT ma_thiet_bi, alert_kind, is_active, previous_value, last_sensor_value, last_seen_at, last_alert_id, resolved_at
         FROM ${ALERT_STATE_TABLE}
         WHERE ma_thiet_bi = ? AND alert_kind = ?
         LIMIT 1`,
        [sensorId, alertKind]
    );

    const state = rows[0] || null;
    if (state) {
        alertStateCache.set(key, state);
    }
    return state;
}

async function upsertAlertState(sensorId, alertKind, patch) {
    await ensureAlertStateTable();
    const current = (await getAlertState(sensorId, alertKind)) || {};
    const next = {
        ma_thiet_bi: sensorId,
        alert_kind: alertKind,
        is_active: patch.is_active ?? current.is_active ?? 0,
        previous_value: patch.previous_value ?? current.previous_value ?? null,
        last_sensor_value: patch.last_value ?? current.last_sensor_value ?? null,
        last_seen_at: patch.last_seen_at ?? current.last_seen_at ?? null,
        last_alert_id: patch.last_alert_id ?? current.last_alert_id ?? null,
        resolved_at: patch.resolved_at ?? current.resolved_at ?? null
    };

    await db.execute(
        `INSERT INTO ${ALERT_STATE_TABLE}
            (ma_thiet_bi, alert_kind, is_active, previous_value, last_sensor_value, last_seen_at, last_alert_id, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            is_active = VALUES(is_active),
            previous_value = VALUES(previous_value),
            last_sensor_value = VALUES(last_sensor_value),
            last_seen_at = VALUES(last_seen_at),
            last_alert_id = VALUES(last_alert_id),
            resolved_at = VALUES(resolved_at)`,
        [
            next.ma_thiet_bi,
            next.alert_kind,
            next.is_active ? 1 : 0,
            next.previous_value,
            next.last_sensor_value,
            next.last_seen_at,
            next.last_alert_id,
            next.resolved_at
        ]
    );

    alertStateCache.set(stateKey(sensorId, alertKind), next);
    return next;
}

async function hydrateAlertStatesFromLogs() {
    await ensureAlertStateTable();
    const [rows] = await db.execute(
        `SELECT ma_log, mo_ta, thoi_gian_khoi_tao
         FROM log_he_thong
         WHERE log_type = 'WARNING' AND acknowledged = 0
         ORDER BY thoi_gian_khoi_tao DESC
         LIMIT 500`
    );

    for (const row of rows) {
        const meta = parseAlertMeta(row.mo_ta);
        if (!meta.sensorId || !meta.warningType) {
            continue;
        }

        const currentValue = Number(meta.currentValue);
        await upsertAlertState(meta.sensorId, meta.warningType, {
            is_active: 1,
            last_value: Number.isFinite(currentValue) ? currentValue : null,
            last_seen_at: row.thoi_gian_khoi_tao,
            last_alert_id: row.ma_log,
            resolved_at: null
        });
    }
}

async function createWarning({ pondId, sensorId, sensorType, value, min, max, warningType, message, maintenancePersonId = null }) {
    const severity = classifySeverity({ sensorType, warningType, value, min, max });
    const description = `[POND:${pondId}] [SENSOR:${sensorId}] [TYPE:${warningType}] [SEVERITY:${severity}] ${message} | value=${value} range=[${min},${max}]`;
    const [result] = await db.execute(
        `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
         VALUES (?, 'WARNING', 'AUTO', 0, ?)`,
        [maintenancePersonId, description]
    );
    return result;
}

function getMaintenancePersonForSensorType(sensorType) {
    const sensorMap = {
        TEMP: 'USR_WORKER_01',
        DO: 'USR_WORKER_01',
        PH: 'USR_WORKER_02',
        LIGHT: 'USR_WORKER_02',
        SALINITY: 'USR_WORKER_01'
    };
    return sensorMap[String(sensorType || '').toUpperCase()] || null;
}

async function applyAutoControl({ pondId, actuatorId, sensorType, value, max }) {
    const targetStatus = Number(value) > Number(max) ? 'HOAT_DONG' : 'TAT';
    await db.execute(
        `UPDATE thiet_bi_tai_bien SET trang_thai = ? WHERE ma_thiet_bi = ?`,
        [targetStatus, actuatorId]
    );

    const controlDescription = `[POND:${pondId}] [ACTUATOR:${actuatorId}] [TYPE:AUTO_CONTROL] Auto set ${sensorType} => ${targetStatus} (value=${value}, max=${max})`;
    await db.execute(
        `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
         VALUES (NULL, 'AUTO_CONTROL', 'AUTO', 1, ?)`,
        [controlDescription]
    );
}

async function checkThresholdWarnings() {
    await ensureAlertStateTable();
    const [rows] = await db.execute(
        `SELECT
            r.ma_rule,
            r.min_value,
            r.max_value,
            r.ma_tb_dieu_khien AS actuator_id,
            cb.ma_thiet_bi AS sensor_id,
            cb.loai_cam_bien,
            an.ma_ao_nuoi AS pond_id,
            an.che_do,
            latest.gia_tri AS latest_value,
            latest.thoi_gian AS latest_time
        FROM rule_dieu_khien r
        JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
        JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
        JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
        JOIN ao_nuoi an ON tb.ma_ao_nuoi = an.ma_ao_nuoi
        LEFT JOIN (
            SELECT d1.ma_cam_bien, d1.gia_tri, d1.thoi_gian
            FROM du_lieu_quan_trac d1
            JOIN (
                SELECT ma_cam_bien, MAX(thoi_gian) AS max_time
                FROM du_lieu_quan_trac
                GROUP BY ma_cam_bien
            ) d2
            ON d1.ma_cam_bien = d2.ma_cam_bien AND d1.thoi_gian = d2.max_time
        ) latest ON latest.ma_cam_bien = cb.ma_thiet_bi`
    );

    for (const row of rows) {
        if (row.latest_value == null || row.min_value == null || row.max_value == null) {
            continue;
        }

        const value = Number(row.latest_value);
        const min = Number(row.min_value);
        const max = Number(row.max_value);

        if (Number.isNaN(value) || Number.isNaN(min) || Number.isNaN(max)) {
            continue;
        }

        const isLow = value < min;
        const isHigh = value > max;
        const warningType = isHigh ? 'THRESHOLD_HIGH' : 'THRESHOLD_LOW';
        const sensorId = row.sensor_id;
        const state = await getAlertState(sensorId, warningType);
        const stateIsActive = Number(state?.is_active || 0) === 1;

        if (!isLow && !isHigh) {
            await upsertAlertState(sensorId, warningType, {
                is_active: 0,
                previous_value: state?.last_sensor_value ?? value,
                last_value: value,
                last_seen_at: row.latest_time,
                resolved_at: stateIsActive ? new Date() : state?.resolved_at ?? null,
                last_alert_id: state?.last_alert_id ?? null
            });
            continue;
        }

        if (stateIsActive) {
            await upsertAlertState(sensorId, warningType, {
                is_active: 1,
                previous_value: state?.previous_value ?? state?.last_sensor_value ?? value,
                last_value: value,
                last_seen_at: row.latest_time,
                last_alert_id: state?.last_alert_id ?? null,
                resolved_at: null
            });
            continue;
        }

        const maintenancePerson = getMaintenancePersonForSensorType(row.loai_cam_bien);
        const created = await createWarning({
            pondId: row.pond_id,
            sensorId: row.sensor_id,
            sensorType: row.loai_cam_bien,
            value,
            min,
            max,
            warningType,
            message: `${row.loai_cam_bien} vượt ngưỡng tại ao ${row.pond_id}`,
            maintenancePersonId: maintenancePerson
        });

        await upsertAlertState(sensorId, warningType, {
            is_active: 1,
            previous_value: state?.last_sensor_value ?? value,
            last_value: value,
            last_seen_at: row.latest_time,
            last_alert_id: created.insertId ?? null,
            resolved_at: null
        });

        if (String(row.che_do).toUpperCase() === 'AUTO' && row.actuator_id) {
            await applyAutoControl({
                pondId: row.pond_id,
                actuatorId: row.actuator_id,
                sensorType: row.loai_cam_bien,
                value,
                max
            });
        }
    }
}

async function checkOfflineWarnings() {
    await ensureAlertStateTable();
    const [rows] = await db.execute(
        `SELECT
            cb.ma_thiet_bi AS sensor_id,
            cb.loai_cam_bien,
            an.ma_ao_nuoi AS pond_id,
            latest.max_time AS latest_time
        FROM cam_bien cb
        JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
        JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
        JOIN ao_nuoi an ON tb.ma_ao_nuoi = an.ma_ao_nuoi
        LEFT JOIN (
            SELECT ma_cam_bien, MAX(thoi_gian) AS max_time
            FROM du_lieu_quan_trac
            GROUP BY ma_cam_bien
        ) latest ON latest.ma_cam_bien = cb.ma_thiet_bi`
    );

    for (const row of rows) {
        const sensorId = row.sensor_id;
        const state = await getAlertState(sensorId, 'OFFLINE');
        const stateIsActive = Number(state?.is_active || 0) === 1;

        let isOffline = false;
        if (!row.latest_time) {
            isOffline = true;
        } else {
            const diffMs = Date.now() - new Date(row.latest_time).getTime();
            if (diffMs >= OFFLINE_MINUTES * 60 * 1000) {
                isOffline = true;
            }
        }

        if (!isOffline) {
            await upsertAlertState(sensorId, 'OFFLINE', {
                is_active: 0,
                previous_value: state?.previous_value ?? null,
                last_value: state?.last_sensor_value ?? null,
                last_seen_at: row.latest_time,
                resolved_at: stateIsActive ? new Date() : state?.resolved_at ?? null,
                last_alert_id: state?.last_alert_id ?? null
            });
            continue;
        }

        if (stateIsActive) {
            await upsertAlertState(sensorId, 'OFFLINE', {
                is_active: 1,
                previous_value: state?.previous_value ?? state?.last_sensor_value ?? null,
                last_value: state?.last_sensor_value ?? null,
                last_seen_at: row.latest_time ?? state?.last_seen_at ?? null,
                last_alert_id: state?.last_alert_id ?? null,
                resolved_at: null
            });
            continue;
        }

        const maintenancePerson = getMaintenancePersonForSensorType(row.loai_cam_bien);
        const created = await createWarning({
            pondId: row.pond_id,
            sensorId,
            sensorType: row.loai_cam_bien,
            value: '',
            min: '',
            max: '',
            warningType: 'OFFLINE',
            message: `Chưa có dữ liệu từ cảm biến ${row.loai_cam_bien} | offline_duration=${OFFLINE_MINUTES}min`,
            maintenancePersonId: maintenancePerson
        });

        await upsertAlertState(sensorId, 'OFFLINE', {
            is_active: 1,
            previous_value: state?.last_sensor_value ?? null,
            last_value: null,
            last_seen_at: row.latest_time ?? new Date(),
            last_alert_id: created.insertId ?? null,
            resolved_at: null
        });
    }
}

async function runAlertCycle() {
    if (cycleRunning) {
        return;
    }

    cycleRunning = true;
    try {
        await ensureAlertStateTable();
        await hydrateAlertStatesFromLogs();
        await checkThresholdWarnings();
        await checkOfflineWarnings();
    } catch (error) {
        console.error('[alert-engine] cycle failed:', error.message);
    } finally {
        cycleRunning = false;
    }
}

function startAlertEngine() {
    void runAlertCycle();
    const timer = setInterval(() => {
        void runAlertCycle();
    }, DEFAULT_INTERVAL_MS);
    return () => clearInterval(timer);
}

module.exports = {
    startAlertEngine
};
