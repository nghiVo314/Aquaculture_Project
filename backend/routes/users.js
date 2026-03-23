const express = require('express');
const router = express.Router();
const db = require('../services/db');

// 1. Get all users and their assigned areas
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT u.ma_nguoi_dung as ID, u.ten_dang_nhap as TenDangNhap, u.trang_thai as TrangThai, r.role_name as RoleName, r.ma_role as Role_ID
             FROM nguoi_dung u
             JOIN role r ON u.ma_role = r.ma_role`
        );

        for (let user of users) {
            const [areas] = await db.execute(
                `SELECT ma_khu_vuc as ID, loai_thuy_san as LoaiHaiSan 
                 FROM khu_vuc 
                 WHERE ma_nguoi_dung_quan_ly = ?`,
                [user.ID]
            );
            user.KhuVucQuanLy = areas;
        }

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update user area permissions
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

// 4. Get permitted ponds for a specific worker
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