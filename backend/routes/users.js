const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireAuth } = require('../middlewares/rbac');

// Lấy danh sách user có role manager để gán quản lý khu vực
router.get('/managers', requireAuth, async (req, res) => {
    try {
        const [managers] = await db.execute(
            `SELECT DISTINCT u.ma_nguoi_dung as ID, u.ten_dang_nhap as TenDangNhap
             FROM nguoi_dung u
             JOIN nguoi_dung_role ur ON u.ma_nguoi_dung = ur.ma_nguoi_dung
             JOIN role r ON ur.ma_role = r.ma_role
               WHERE LOWER(r.role_name) IN ('manager', 'quan ly', 'quản lý')
             ORDER BY u.ten_dang_nhap ASC`
        );

        res.json(managers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// 2. Thêm người dùng mới & Gán Role
router.post('/', async (req, res) => {
    const { ten_dang_nhap, mat_khau, ma_role } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const ma_nguoi_dung = `USR_${Date.now()}`; // Có thể dùng UUID
        
        // Thêm vào bảng nguoi_dung
        await connection.execute(
            `INSERT INTO nguoi_dung (ma_nguoi_dung, ten_dang_nhap, mat_khau) VALUES (?, ?, ?)`,
            [ma_nguoi_dung, ten_dang_nhap, mat_khau] // Lưu ý: Nên hash password bằng bcrypt ở thực tế
        );

        // Gán role vào bảng nguoi_dung_role
        if (ma_role) {
            await connection.execute(
                `INSERT INTO nguoi_dung_role (ma_nguoi_dung, ma_role) VALUES (?, ?)`,
                [ma_nguoi_dung, ma_role]
            );
        }

        await connection.commit();
        res.json({ status: 'success', message: 'Tạo người dùng thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 3. Cập nhật Role cho User
router.put('/:id/role', async (req, res) => {
    const { id } = req.params;
    const { ma_role } = req.body;
    try {
        // Cập nhật đơn giản: Xóa role cũ và thêm role mới (giả định 1 user 1 role chính)
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

        // Remove this user as manager from old zones
        await connection.execute(`UPDATE khu_vuc SET ma_nguoi_dung_quan_ly = NULL WHERE ma_nguoi_dung_quan_ly = ?`, [userId]);

        // Assign user as manager to new zones
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
        const [ponds] = await db.execute(
            `SELECT a.ma_ao_nuoi as AoNuoi_ID, a.ma_khu_vuc as KhuVuc_ID, k.loai_thuy_san as LoaiHaiSan
             FROM ao_nuoi a
             JOIN khu_vuc k ON a.ma_khu_vuc = k.ma_khu_vuc
             WHERE k.ma_nguoi_dung_quan_ly = ?`,
            [req.params.user_id]
        );
        res.json(ponds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;