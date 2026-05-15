const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth, requirePermission } = require('../middlewares/rbac');
const { listCurrentAlerts, listAlertHistory } = require('../services/alerts');

router.get('/', requireAuth, async (req, res) => {
    try {
        const status = String(req.query.status || '').trim().toLowerCase();
        const pondId = String(req.query.pond_id || '').trim();
        const sort = String(req.query.sort || 'urgent').trim().toLowerCase();
        const days = Number.parseInt(req.query.days || '', 10);

        const rows = await listCurrentAlerts({
            user: req.user,
            status,
            pondId: pondId || undefined,
            sort,
            days: Number.isFinite(days) && days > 0 ? days : undefined
        });

        res.json(rows);
    } catch (error) {
        console.error('[alerts] list failed:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/history', requireAuth, async (req, res) => {
    try {
        const pondId = String(req.query.pond_id || '').trim();
        const sensorId = String(req.query.sensor_id || '').trim();
        const status = String(req.query.status || 'all').trim().toLowerCase();
        const sort = String(req.query.sort || 'newest').trim().toLowerCase();
        const days = Number.parseInt(req.query.days || '', 10);
        const limit = Number.parseInt(req.query.limit || '200', 10);

        const rows = await listAlertHistory({
            user: req.user,
            pondId: pondId || undefined,
            sensorId: sensorId || undefined,
            status,
            sort,
            days: Number.isFinite(days) && days > 0 ? days : undefined,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 200
        });

        res.json(rows);
    } catch (error) {
        console.error('[alerts] history failed:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/:log_id/ack', requireAuth, requirePermission('alerts:ack'), async (req, res) => {
    const username = req.user.username;
    try {
        const [result] = await db.execute(
            `UPDATE log_he_thong
             SET acknowledged = 1,
                 mo_ta = CASE
                    WHEN mo_ta LIKE '%(Đã xử lý bởi User:%' THEN mo_ta
                    ELSE CONCAT(mo_ta, ' (Đã xử lý bởi User: ', ?, ')')
                 END
             WHERE ma_log = ?`,
            [username, req.params.log_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy cảnh báo để xác nhận' });
        }

        res.json({ status: 'success', message: 'Đã đánh dấu cảnh báo là đã xử lý' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
