// Đăng nhập, đăng xuất, cấp token.
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/login', async (req, res) => {
    const { TenDangNhap, MatKhau } = req.body;

    try {
        const [users] = await db.execute(
            `SELECT ID, Role_ID, TenDangNhap 
             FROM User 
             WHERE TenDangNhap = ? AND MatKhau = ? AND TrangThai = 1`,
            [TenDangNhap, MatKhau]
        );

        const user = users[0];

        if (user) {
            await db.execute(
                `INSERT INTO Log (User_ID, LogType, MoTa, CreatedAt, Acknowledged)
                 VALUES (?, 'LOGIN', 'Người dùng đăng nhập thành công', NOW(), 1)`,
                [user.ID]
            );

            res.json({
                status: 'success',
                message: 'Đăng nhập thành công',
                user: user
            });
        } else {
            res.status(401).json({ status: 'error', message: 'Sai tài khoản, mật khẩu hoặc tài khoản bị khóa' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;