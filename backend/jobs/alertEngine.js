const db = require('../services/db');
const {
    ensureAlertStateTable,
    classifyAlertSeverity,
    buildAlertMessage,
    buildAlertDescription,
    normalizeAlertKind,
    parseNumeric,
    stateKey
} = require('../services/alerts');

const DEFAULT_INTERVAL_MS = Number(process.env.ALERT_ENGINE_INTERVAL_MS || 15000);
const OFFLINE_MINUTES = Number(process.env.SENSOR_OFFLINE_MINUTES || 10);
const ALERT_STATE_TABLE = 'alert_trang_thai';

const alertStateCache = new Map();
let cycleRunning = false;

async function getAlertState(sensorId, alertKind) {
    await ensureAlertStateTable();
    const key = stateKey(sensorId, alertKind);
    if (alertStateCache.has(key)) {
        return alertStateCache.get(key);
    }

    const [rows] = await db.execute(
        `SELECT
            ma_thiet_bi,
            alert_kind,
            is_active,
            previous_value,
            last_sensor_value,
            last_seen_at,
            last_alert_id,
            resolved_at,
            severity,
            alert_message,
            updated_at
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
        last_sensor_value: patch.last_sensor_value ?? current.last_sensor_value ?? null,
        last_seen_at: patch.last_seen_at ?? current.last_seen_at ?? null,
        last_alert_id: patch.last_alert_id ?? current.last_alert_id ?? null,
        resolved_at: patch.resolved_at ?? current.resolved_at ?? null,
        severity: patch.severity ?? current.severity ?? null,
        alert_message: patch.alert_message ?? current.alert_message ?? null
    };

    await db.execute(
        `INSERT INTO ${ALERT_STATE_TABLE}
            (ma_thiet_bi, alert_kind, is_active, previous_value, last_sensor_value, last_seen_at, last_alert_id, resolved_at, severity, alert_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            is_active = VALUES(is_active),
            previous_value = VALUES(previous_value),
            last_sensor_value = VALUES(last_sensor_value),
            last_seen_at = VALUES(last_seen_at),
            last_alert_id = VALUES(last_alert_id),
            resolved_at = VALUES(resolved_at),
            severity = VALUES(severity),
            alert_message = VALUES(alert_message)`,
        [
            next.ma_thiet_bi,
            next.alert_kind,
            next.is_active ? 1 : 0,
            next.previous_value,
            next.last_sensor_value,
            next.last_seen_at,
            next.last_alert_id,
            next.resolved_at,
            next.severity,
            next.alert_message
        ]
    );

    alertStateCache.set(stateKey(sensorId, alertKind), next);
    return next;
}

async function hydrateAlertStatesFromLogs() {
    await ensureAlertStateTable();
    const [rows] = await db.execute(
        `SELECT ma_log, mo_ta, thoi_gian_khoi_tao, acknowledged
         FROM log_he_thong
         WHERE log_type = 'WARNING'
         ORDER BY thoi_gian_khoi_tao DESC
         LIMIT 500`
    );

    for (const row of rows) {
        const text = String(row.mo_ta || '');
        const sensorId = (text.match(/\[SENSOR:([^\]]+)\]/i)?.[1] || '').trim();
        const alertKind = (text.match(/\[TYPE:([^\]]+)\]/i)?.[1] || '').trim().toUpperCase();
        const severity = (text.match(/\[SEVERITY:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase();
        const message = text.replace(/\[[A-Z_]+:[^\]]+\]\s*/gi, '').trim();
        const numericValue = parseNumeric(text.match(/\[VALUE:([^\]]+)\]/i)?.[1]);

        if (!sensorId || !alertKind) {
            continue;
        }

        const existing = await getAlertState(sensorId, alertKind);
        if (existing) {
            continue;
        }

        await upsertAlertState(sensorId, alertKind, {
            is_active: row.acknowledged ? 0 : 1,
            previous_value: numericValue,
            last_sensor_value: numericValue,
            last_seen_at: row.thoi_gian_khoi_tao,
            last_alert_id: row.ma_log,
            resolved_at: row.acknowledged ? row.thoi_gian_khoi_tao : null,
            severity: severity || 'medium',
            alert_message: message || null
        });
    }
}

async function createWarning({
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
    maintenancePersonId = null,
    message
}) {
    const description = buildAlertDescription({
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
    });

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
        OXYGEN: 'USR_WORKER_01',
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

async function activateAlert({
    sensorId,
    alertKind,
    pondId,
    sensorType,
    value,
    min,
    max,
    offlineMinutes,
    hasReading,
    lastSeenAt
}) {
    const normalizedKind = normalizeAlertKind(alertKind, hasReading);
    const severity = classifyAlertSeverity({
        sensorType,
        warningType: normalizedKind,
        value,
        min,
        max,
        offlineMinutes,
        baseOfflineMinutes: OFFLINE_MINUTES,
        hasReading
    });
    const message = buildAlertMessage({
        pondId,
        sensorId,
        sensorType,
        warningType: normalizedKind,
        value,
        min,
        max,
        offlineMinutes,
        hasReading
    });

    const state = await getAlertState(sensorId, normalizedKind);
    const shouldCreateLog = !state || Number(state.is_active || 0) !== 1 || state.severity !== severity || state.alert_message !== message;

    let lastAlertId = state?.last_alert_id ?? null;
    if (shouldCreateLog) {
        const created = await createWarning({
            pondId,
            sensorId,
            sensorType,
            warningType: normalizedKind,
            severity,
            value,
            min,
            max,
            offlineMinutes,
            hasReading,
            maintenancePersonId: getMaintenancePersonForSensorType(sensorType),
            message
        });
        lastAlertId = created.insertId ?? lastAlertId;
    }

    await upsertAlertState(sensorId, normalizedKind, {
        is_active: 1,
        previous_value: state?.last_sensor_value ?? parseNumeric(value),
        last_sensor_value: parseNumeric(value),
        last_seen_at: lastSeenAt ?? state?.last_seen_at ?? null,
        last_alert_id: lastAlertId,
        resolved_at: null,
        severity,
        alert_message: message
    });

    return { severity, message, created: shouldCreateLog };
}

async function deactivateAlert(sensorId, alertKind, { value, lastSeenAt } = {}) {
    const state = await getAlertState(sensorId, alertKind);
    if (!state) {
        return;
    }

    await upsertAlertState(sensorId, alertKind, {
        is_active: 0,
        previous_value: state.last_sensor_value ?? state.previous_value ?? parseNumeric(value),
        last_sensor_value: parseNumeric(value) ?? state.last_sensor_value ?? null,
        last_seen_at: lastSeenAt ?? state.last_seen_at ?? null,
        last_alert_id: state.last_alert_id ?? null,
        resolved_at: Number(state.is_active || 0) === 1 ? new Date() : state.resolved_at ?? null,
        severity: state.severity ?? null,
        alert_message: state.alert_message ?? null
    });
}

async function checkThresholdWarnings() {
    await ensureAlertStateTable();
    const [rows] = await db.execute(
        `SELECT
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
              ON d1.ma_cam_bien = d2.ma_cam_bien
             AND d1.thoi_gian = d2.max_time
        ) latest ON latest.ma_cam_bien = cb.ma_thiet_bi`
    );

    for (const row of rows) {
        const value = parseNumeric(row.latest_value);
        const min = parseNumeric(row.min_value);
        const max = parseNumeric(row.max_value);

        if (value == null || min == null || max == null) {
            continue;
        }

        const isLow = value < min;
        const isHigh = value > max;

        if (!isLow && !isHigh) {
            await deactivateAlert(row.sensor_id, 'THRESHOLD_LOW', {
                value,
                lastSeenAt: row.latest_time
            });
            await deactivateAlert(row.sensor_id, 'THRESHOLD_HIGH', {
                value,
                lastSeenAt: row.latest_time
            });
            continue;
        }

        const alertKind = isHigh ? 'THRESHOLD_HIGH' : 'THRESHOLD_LOW';
        const oppositeKind = isHigh ? 'THRESHOLD_LOW' : 'THRESHOLD_HIGH';

        await deactivateAlert(row.sensor_id, oppositeKind, {
            value,
            lastSeenAt: row.latest_time
        });

        const result = await activateAlert({
            sensorId: row.sensor_id,
            alertKind,
            pondId: row.pond_id,
            sensorType: row.loai_cam_bien,
            value,
            min,
            max,
            hasReading: true,
            lastSeenAt: row.latest_time
        });

        if (result.created && String(row.che_do).toUpperCase() === 'AUTO' && row.actuator_id) {
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
        const lastSeenAt = row.latest_time ? new Date(row.latest_time) : null;
        const hasReading = Boolean(lastSeenAt);
        const offlineMinutes = hasReading
            ? Math.max(0, Math.floor((Date.now() - lastSeenAt.getTime()) / 60000))
            : OFFLINE_MINUTES;

        const shouldCreateMissingData = !hasReading;
        const shouldCreateOffline = hasReading && offlineMinutes >= OFFLINE_MINUTES;

        if (shouldCreateMissingData) {
            await deactivateAlert(row.sensor_id, 'OFFLINE', { lastSeenAt: null });
            await activateAlert({
                sensorId: row.sensor_id,
                alertKind: 'MISSING_DATA',
                pondId: row.pond_id,
                sensorType: row.loai_cam_bien,
                value: null,
                min: null,
                max: null,
                offlineMinutes,
                hasReading: false,
                lastSeenAt: null
            });
            continue;
        }

        await deactivateAlert(row.sensor_id, 'MISSING_DATA', {
            value: null,
            lastSeenAt: row.latest_time
        });

        if (!shouldCreateOffline) {
            await deactivateAlert(row.sensor_id, 'OFFLINE', {
                value: null,
                lastSeenAt: row.latest_time
            });
            continue;
        }

        await activateAlert({
            sensorId: row.sensor_id,
            alertKind: 'OFFLINE',
            pondId: row.pond_id,
            sensorType: row.loai_cam_bien,
            value: null,
            min: null,
            max: null,
            offlineMinutes,
            hasReading: true,
            lastSeenAt: row.latest_time
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
