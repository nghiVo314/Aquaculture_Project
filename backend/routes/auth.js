const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/login', async (req, res) => {
    const { TenDangNhap, MatKhau } = req.body;

    try {
        const [users] = await db.execute(
            `SELECT ma_nguoi_dung as ID, ma_role as Role_ID, ten_dang_nhap as TenDangNhap 
             FROM nguoi_dung 
             WHERE ten_dang_nhap = ? AND mat_khau = ? AND trang_thai = 1`,
            [TenDangNhap, MatKhau]
        );

        const user = users[0];

        if (user) {
            await db.execute(
                `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, mo_ta, acknowledged)
                 VALUES (?, 'LOGIN', 'Người dùng đăng nhập thành công', 1)`,
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