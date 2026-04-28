const db = require('../services/db');

const DEFAULT_INTERVAL_MS = Number(process.env.ALERT_ENGINE_INTERVAL_MS || 15000);
const OFFLINE_MINUTES = Number(process.env.SENSOR_OFFLINE_MINUTES || 10);
const ALERT_TTL_MS = Number(process.env.ALERT_DEDUP_TTL_MS || 5 * 60 * 1000);

const dedupCache = new Map();

function shouldEmit(key) {
    const now = Date.now();
    const last = dedupCache.get(key);
    if (last && now - last < ALERT_TTL_MS) {
        return false;
    }
    dedupCache.set(key, now);
    return true;
}

function purgeDedupCache() {
    const now = Date.now();
    for (const [key, ts] of dedupCache.entries()) {
        if (now - ts > ALERT_TTL_MS * 3) {
            dedupCache.delete(key);
        }
    }
}

async function createWarning({ pondId, sensorId, sensorType, value, min, max, warningType, message }) {
    const description = `[POND:${pondId}] [SENSOR:${sensorId}] [TYPE:${warningType}] ${message} | value=${value} range=[${min},${max}]`;
    await db.execute(
        `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
         VALUES (NULL, 'WARNING', 'AUTO', 0, ?)`,
        [description]
    );
}

async function applyAutoControl({ pondId, actuatorId, sensorType, value, max }) {
    const targetStatus = Number(value) > Number(max) ? 'ON' : 'OFF';
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
        if (!isLow && !isHigh) {
            continue;
        }

        const type = isHigh ? 'THRESHOLD_HIGH' : 'THRESHOLD_LOW';
        const cacheKey = `warn:${row.ma_rule}:${type}`;
        if (!shouldEmit(cacheKey)) {
            continue;
        }

        await createWarning({
            pondId: row.pond_id,
            sensorId: row.sensor_id,
            sensorType: row.loai_cam_bien,
            value,
            min,
            max,
            warningType: type,
            message: `${row.loai_cam_bien} vượt ngưỡng tại ao ${row.pond_id}`
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
        const cacheKey = `offline:${row.sensor_id}`;
        if (!row.latest_time) {
            if (shouldEmit(cacheKey)) {
                await db.execute(
                    `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
                     VALUES (NULL, 'WARNING', 'AUTO', 0, ?)`,
                    [`[POND:${row.pond_id}] [SENSOR:${row.sensor_id}] [TYPE:OFFLINE] Chưa có dữ liệu cảm biến ${row.loai_cam_bien}`]
                );
            }
            continue;
        }

        const diffMs = Date.now() - new Date(row.latest_time).getTime();
        if (diffMs < OFFLINE_MINUTES * 60 * 1000) {
            continue;
        }

        if (!shouldEmit(cacheKey)) {
            continue;
        }

        await db.execute(
            `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
             VALUES (NULL, 'WARNING', 'AUTO', 0, ?)`,
            [`[POND:${row.pond_id}] [SENSOR:${row.sensor_id}] [TYPE:OFFLINE] Sensor ${row.loai_cam_bien} offline quá ${OFFLINE_MINUTES} phút`]
        );
    }
}

async function runAlertCycle() {
    try {
        await checkThresholdWarnings();
        await checkOfflineWarnings();
        purgeDedupCache();
    } catch (error) {
        console.error('[alert-engine] cycle failed:', error.message);
    }
}

function startAlertEngine() {
    const timer = setInterval(runAlertCycle, DEFAULT_INTERVAL_MS);
    runAlertCycle();
    return () => clearInterval(timer);
}

module.exports = {
    startAlertEngine
};
