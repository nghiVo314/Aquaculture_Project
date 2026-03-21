// Quản lý tài khoản người dùng.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// 1. Get all users and their assigned areas
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT u.ID, u.TenDangNhap, u.TrangThai, r.RoleName, r.ID as Role_ID
             FROM User u
             JOIN Role r ON u.Role_ID = r.ID`
        );

        // Fetch area permissions for each user
        for (let user of users) {
            const [areas] = await db.execute(
                `SELECT kv.ID, kv.LoaiHaiSan 
                 FROM User_Area ua
                 JOIN KhuVuc kv ON ua.KhuVuc_ID = kv.ID
                 WHERE ua.User_ID = ?`,
                [user.ID]
            );
            user.KhuVucQuanLy = areas;
        }

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Add new user with area permissions
router.post('/', async (req, res) => {
    const { TenDangNhap, MatKhau, Role_ID, KhuVucQuanLy } = req.body;
    const connection = await db.getConnection(); // Use connection for transactions

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO User (TenDangNhap, MatKhau, Role_ID, TrangThai) VALUES (?, ?, ?, 1)`,
            [TenDangNhap, MatKhau, Role_ID]
        );
        const userId = result.insertId;

        if (KhuVucQuanLy && KhuVucQuanLy.length > 0) {
            for (let kv_id of KhuVucQuanLy) {
                await connection.execute(
                    `INSERT INTO User_Area (User_ID, KhuVuc_ID) VALUES (?, ?)`,
                    [userId, kv_id]
                );
            }
        }

        await connection.commit();
        res.json({ status: 'success', message: 'Tạo tài khoản thành công!' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

// 3. Update user area permissions
router.put('/:user_id/areas', async (req, res) => {
    const userId = req.params.user_id;
    const { khuvuc_ids } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Step 1: Delete old permissions
        await connection.execute(`DELETE FROM User_Area WHERE User_ID = ?`, [userId]);

        // Step 2: Insert new permissions
        for (let kv_id of khuvuc_ids) {
            await connection.execute(
                `INSERT INTO User_Area (User_ID, KhuVuc_ID) VALUES (?, ?)`,
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
            `SELECT a.AoNuoi_ID, a.KhuVuc_ID, k.LoaiHaiSan
             FROM AoNuoi_TramBien a
             JOIN KhuVuc k ON a.KhuVuc_ID = k.ID
             JOIN User_Area ua ON k.ID = ua.KhuVuc_ID
             WHERE ua.User_ID = ?`,
            [req.params.user_id]
        );
        res.json(ponds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;