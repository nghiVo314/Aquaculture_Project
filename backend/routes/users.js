const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth } = require('../middlewares/rbac');

function isAdmin(req) {
    return Array.isArray(req.user?.roles) && req.user.roles.includes('admin');
}
// Hàm ghi log hệ thống
async function ghiLog(ma_nguoi_dung, log_type, mo_ta) {
    try {
        await db.execute(
            `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta) 
             VALUES (?, ?, 'MANUAL', 1, ?)`,
            [ma_nguoi_dung, log_type, mo_ta]
        );
    } catch (error) {
        console.log('Lỗi ghi log:', error.message);
    }
}

// 1. Lấy tất cả users (Cập nhật query theo DB mới)
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT u.ma_nguoi_dung as ID, u.ten_dang_nhap as TenDangNhap, u.trang_thai as TrangThai, 
                    r.role_name as RoleName, r.ma_role as Role_ID
             FROM nguoi_dung u
             LEFT JOIN nguoi_dung_role ur ON u.ma_nguoi_dung = ur.ma_nguoi_dung
             LEFT JOIN role r ON ur.ma_role = r.ma_role`
        );

        for (let user of users) {
            const [areas] = await db.execute(
                `SELECT ma_khu_vuc as ID, loai_thuy_san as LoaiHaiSan 
                 FROM khu_vuc 
                 WHERE ma_nguoi_dung_quan_ly = ?`,
                [user.ID]
            );
            user.KhuVucQuanLy = areas || [];
        }

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1b. Lấy danh sách người quản lý để gán cho khu vực
router.get('/managers', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT
                u.ma_nguoi_dung AS ma_nguoi_dung,
                u.ten_dang_nhap AS ten_dang_nhap,
                r.ma_role AS ma_role,
                r.role_name AS role_name
             FROM nguoi_dung u
             INNER JOIN nguoi_dung_role ur ON u.ma_nguoi_dung = ur.ma_nguoi_dung
             INNER JOIN role r ON ur.ma_role = r.ma_role
             WHERE r.ma_role = 'manager' OR LOWER(r.role_name) LIKE '%quản lý%'
             ORDER BY u.ten_dang_nhap ASC`
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1c. Lấy danh sách worker để gán cho ao nuôi
router.get('/workers', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT DISTINCT
                u.ma_nguoi_dung AS ma_nguoi_dung,
                u.ten_dang_nhap AS ten_dang_nhap,
                r.ma_role AS ma_role,
                r.role_name AS role_name
             FROM nguoi_dung u
             INNER JOIN nguoi_dung_role ur ON u.ma_nguoi_dung = ur.ma_nguoi_dung
             INNER JOIN role r ON ur.ma_role = r.ma_role
             WHERE r.ma_role = 'worker' OR LOWER(r.role_name) LIKE '%công nhân%'
             ORDER BY u.ten_dang_nhap ASC`
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1d. Lấy thống kê workload cho mỗi worker (số ao, số cảnh báo chưa xác nhận)
router.get('/workers/workload/stats', requireAuth, async (req, res) => {
    try {
        const [workers] = await db.execute(
            `SELECT DISTINCT
                u.ma_nguoi_dung,
                u.ten_dang_nhap,
                r.ma_role,
                r.role_name
             FROM nguoi_dung u
             INNER JOIN nguoi_dung_role ur ON u.ma_nguoi_dung = ur.ma_nguoi_dung
             INNER JOIN role r ON ur.ma_role = r.ma_role
             WHERE r.ma_role = 'worker' OR LOWER(r.role_name) LIKE '%công nhân%'
             ORDER BY u.ten_dang_nhap ASC`
        );

        const [workerTableCheck] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'ao_nuoi_workers'`
        );
        const hasWorkerAssignments = Number(workerTableCheck?.[0]?.total || 0) > 0;

        const workloadData = [];

        for (const worker of workers) {
            // Lấy danh sách ao phụ trách
            const [ponds] = hasWorkerAssignments
                ? await db.execute(
                    `SELECT DISTINCT pond.ma_ao_nuoi, pond.ma_khu_vuc, pond.dien_tich, pond.loai_thuy_san
                     FROM (
                         SELECT a.ma_ao_nuoi, a.ma_khu_vuc, a.dien_tich, k.loai_thuy_san
                         FROM ao_nuoi_workers aow
                         JOIN ao_nuoi a ON aow.ma_ao_nuoi = a.ma_ao_nuoi
                         JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
                         WHERE aow.ma_nguoi_dung = ?
                         UNION ALL
                         SELECT a.ma_ao_nuoi, a.ma_khu_vuc, a.dien_tich, k.loai_thuy_san
                         FROM ao_nuoi a
                         JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
                         WHERE a.ma_nguoi_dung_phu_trach = ?
                     ) AS pond`,
                    [worker.ma_nguoi_dung, worker.ma_nguoi_dung]
                )
                : await db.execute(
                    `SELECT a.ma_ao_nuoi, a.ma_khu_vuc, a.dien_tich, k.loai_thuy_san
                     FROM ao_nuoi a
                     JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
                     WHERE a.ma_nguoi_dung_phu_trach = ?`,
                    [worker.ma_nguoi_dung]
                );

            // Lấy số cảnh báo chưa xác nhận cho các ao của worker này
            let unacknowledgedAlerts = 0;
            if (ponds.length > 0) {
                const pondIds = ponds.map(p => p.ma_ao_nuoi);
                for (const pondId of pondIds) {
                    const [alerts] = await db.execute(
                        `SELECT COUNT(*) as count FROM log_he_thong
                         WHERE log_type = 'WARNING'
                           AND acknowledged = 0
                           AND mo_ta LIKE ?`,
                        [`%[POND:${pondId}]%`]
                    );
                    unacknowledgedAlerts += alerts[0]?.count || 0;
                }
            }

            workloadData.push({
                ma_nguoi_dung: worker.ma_nguoi_dung,
                ten_dang_nhap: worker.ten_dang_nhap,
                ma_role: worker.ma_role,
                role_name: worker.role_name,
                pond_count: ponds.length,
                assigned_ponds: ponds,
                unacknowledged_alerts: unacknowledgedAlerts
            });
        }

        res.json(workloadData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Thêm người dùng mới & Gán Role
router.post('/', async (req, res) => {
    const { ten_dang_nhap, mat_khau, ma_role } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const ma_nguoi_dung = `USR_${Date.now()}`;
        
        await connection.execute(
            `INSERT INTO nguoi_dung (ma_nguoi_dung, ten_dang_nhap, mat_khau) VALUES (?, ?, ?)`,
            [ma_nguoi_dung, ten_dang_nhap, mat_khau]
        );

        // if (ma_role) {
        //     await connection.execute(
        //         `INSERT INTO nguoi_dung_role (ma_nguoi_dung, ma_role) VALUES (?, ?)`,
        //         [ma_nguoi_dung, ma_role]
        //     );
        // }
        //Logic gán vai trò mặc định. Nếu ma_role không được cung cấp, sẽ gán ROLE_ADMIN
        const assignedRole = ma_role || 'ROLE_ADMIN'; 

        await connection.execute(
            `INSERT INTO nguoi_dung_role (ma_nguoi_dung, ma_role) VALUES (?, ?)`,
            [ma_nguoi_dung, assignedRole]
        );

        await connection.commit();
        // Ghi log sau khi tạo user thành công
        const creatorId = req.user?.id || 'USR_ADMIN'; 
        await ghiLog(creatorId, 'CREATE_USER', `Thêm mới người dùng: ${ten_dang_nhap}`);

        res.json({ status: 'success', message: 'Tạo người dùng thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 3. Cập nhật Role cho User
router.put('/:id/role', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { ma_role } = req.body;
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Bạn không có quyền cập nhật vai trò' });
        }

        if (String(req.user.id) === String(id)) {
            return res.status(400).json({ error: 'Không thể tự thay đổi vai trò của chính bạn' });
        }

        await db.execute(`DELETE FROM nguoi_dung_role WHERE ma_nguoi_dung = ?`, [id]);
        await db.execute(`INSERT INTO nguoi_dung_role (ma_nguoi_dung, ma_role) VALUES (?, ?)`, [id, ma_role]);
        res.json({ status: 'success', message: 'Cập nhật quyền thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 4. Update user area permissions
router.put('/:user_id/areas', async (req, res) => {
    const userId = req.params.user_id;
    const { khuvuc_ids } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.execute(
            `UPDATE khu_vuc SET ma_nguoi_dung_quan_ly = NULL WHERE ma_nguoi_dung_quan_ly = ?`,
            [userId]
        );

        for (let kv_id of khuvuc_ids) {
            await connection.execute(
                `UPDATE khu_vuc SET ma_nguoi_dung_quan_ly = ? WHERE ma_khu_vuc = ?`,
                [userId, kv_id]
            );
        }

        await connection.commit();
        res.json({ status: 'success', message: 'Cập nhật phân quyền thành công!' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

// 5. Get permitted ponds for a specific worker
router.get('/:user_id/my-ponds', async (req, res) => {
    try {
        const pondRoutes = require('./ponds');
        if (pondRoutes?.ensurePondWorkerColumn) {
            await pondRoutes.ensurePondWorkerColumn(db);
        }
        const [ponds] = await db.execute(
            `SELECT a.ma_ao_nuoi as AoNuoi_ID, a.ma_khu_vuc as KhuVuc_ID, k.loai_thuy_san as LoaiHaiSan
             FROM ao_nuoi a
             JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
             WHERE a.ma_nguoi_dung_phu_trach = ?`,
            [req.params.user_id]
        );
        res.json(ponds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Xóa cứng user (hard delete)
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { ly_do_xoa } = req.body || {};
    const connection = await db.getConnection();

    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Bạn không có quyền xóa người dùng' });
        }

        if (String(req.user.id) === String(id)) {
            return res.status(400).json({ status: 'error', message: 'Không thể tự xóa tài khoản của chính bạn' });
        }

        if (!ly_do_xoa || !String(ly_do_xoa).trim()) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng nhập lý do xóa' });
        }

        await connection.beginTransaction();

        const [users] = await connection.execute(
            'SELECT ma_nguoi_dung, ten_dang_nhap FROM nguoi_dung WHERE ma_nguoi_dung = ?',
            [id]
        );
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
        }

        // Bắt buộc user phải bỏ liên kết khu vực trước khi xóa
        const [zones] = await connection.execute(
            'SELECT ma_khu_vuc FROM khu_vuc WHERE ma_nguoi_dung_quan_ly = ?',
            [id]
        );
        if (zones.length > 0) {
            await connection.rollback();
            const zoneList = zones.map(z => z.ma_khu_vuc).join(', ');
            return res.status(409).json({
                status: 'error',
                message: `Không thể xóa. Người dùng vẫn đang quản lý khu vực: ${zoneList}. Hãy bỏ liên kết khu vực trước.`
            });
        }

        const targetUser = users[0];

        // Ghi log trước khi xóa để giữ thông tin audit
        const moTa = `Admin ${req.user.username} xóa user ${targetUser.ten_dang_nhap} (${id}). Lý do: ${String(ly_do_xoa).trim()}`;
        await connection.execute(
            `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, source_type, acknowledged, mo_ta)
             VALUES (?, 'DELETE_USER', 'MANUAL', 1, ?)`,
            [req.user.id, moTa]
        );
        await ghiLog(req.user.id, 'DELETE_USER', `Xóa người dùng ${users[0].ten_dang_nhap}.`);

        // Hard delete
        await connection.execute(
            'DELETE FROM nguoi_dung WHERE ma_nguoi_dung = ?',
            [id]
        );

        await connection.commit();
        return res.json({ status: 'success', message: 'Đã xóa người dùng khỏi hệ thống' });
    } catch (error) {
        await connection.rollback();
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

module.exports = router;