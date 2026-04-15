const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { signUserToken, requireAuth } = require('../middlewares/rbac');

// ==========================================
// HÀM HỖ TRỢ CHUẨN HÓA TÊN ROLE
// ==========================================
function normalizeText(value = '') {
    return String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

const ROLE_ALIAS = {
    admin: ['admin', 'ad', 'quan tri', 'quan tri vien', 'administrator', 'role_admin'],
    manager: ['manager', 'chu trang trai', 'chutrangtrai', 'farm manager', 'role_manager'],
    worker: ['cong nhan van hanh', 'cong nhan', 'worker', 'operator', 'role_worker']
};

function normalizeRoleName(value = '') {
    const normalized = normalizeText(value);
    if (ROLE_ALIAS.admin.includes(normalized)) return 'admin';
    if (ROLE_ALIAS.manager.includes(normalized)) return 'manager';
    if (ROLE_ALIAS.worker.includes(normalized)) return 'worker';
    return normalized;
}

// Giữ nguyên hàm tạo Role mặc định
async function ensureDefaultRoles() {
    const [existing] = await db.execute('SELECT ma_role FROM role LIMIT 1');
    if (existing.length > 0) return;

    await db.execute(
        `INSERT INTO role (ma_role, role_name, mo_ta)
         VALUES
            ('admin', 'Admin', 'Toàn quyền hệ thống'),
            ('manager', 'Manager', 'Chủ trang trại'),
            ('worker', 'Công nhân vận hành', 'Xem và điều khiển')`
    );
}

// Phân giải Role từ chuỗi đầu vào
async function resolveRoleIdByName(roleInput) {
    await ensureDefaultRoles();

    const normalized = normalizeRoleName(roleInput || 'worker');
    const [roles] = await db.execute(`SELECT ma_role, role_name FROM role`);

    const found = roles.find((role) => {
        const normalizedRoleName = normalizeRoleName(role.role_name || '');
        const normalizedRoleId = normalizeRoleName(role.ma_role || '');
        return normalizedRoleName === normalized || normalizedRoleId === normalized;
    });
    if (found) return found.ma_role;

    const byCommonLabel = roles.find((role) => {
        const roleName = normalizeRoleName(role.role_name || '');
        return (
            (normalized === 'admin' && roleName === 'admin') ||
            (normalized === 'manager' && roleName === 'manager') ||
            (normalized === 'worker' && roleName === 'worker')
        );
    });
    if (byCommonLabel) return byCommonLabel.ma_role;

    const roleById = roles.find((role) => ['admin', 'manager', 'worker'].includes(normalizeRoleName(role.ma_role || '')));
    if (roleById) return roleById.ma_role;

    return null;
}

// Tạo mã người dùng ngẫu nhiên
function generateUserId(username) {
    const safe = String(username || 'user').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12) || 'USER';
    return `${safe}_${Date.now()}`;
}

// ==========================================
// API: ĐĂNG KÝ (REGISTER)
// ==========================================
router.post('/register', async (req, res) => {
    const { TenDangNhap, MatKhau, RoleName } = req.body;

    if (!TenDangNhap || !MatKhau) {
        return res.status(400).json({ status: 'error', message: 'Thiếu tên đăng nhập hoặc mật khẩu' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute(
            'SELECT ma_nguoi_dung FROM nguoi_dung WHERE ten_dang_nhap = ?',
            [TenDangNhap]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ status: 'error', message: 'Tên đăng nhập đã tồn tại' });
        }

        const roleId = await resolveRoleIdByName(RoleName);
        if (!roleId) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'Không tìm thấy vai trò phù hợp' });
        }

        const userId = generateUserId(TenDangNhap);

        // Chèn vào bảng User
        await connection.execute(
            `INSERT INTO nguoi_dung (ma_nguoi_dung, ten_dang_nhap, mat_khau, trang_thai)
             VALUES (?, ?, ?, 1)`,
            [userId, TenDangNhap, MatKhau]
        );

        // Chèn vào bảng trung gian Role
        await connection.execute(
            `INSERT INTO nguoi_dung_role (ma_nguoi_dung, ma_role)
             VALUES (?, ?)`,
            [userId, roleId]
        );

        await connection.commit();
        res.json({ status: 'success', message: 'Tạo tài khoản thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

// ==========================================
// API: ĐĂNG NHẬP (LOGIN)
// ==========================================
router.post('/login', async (req, res) => {
    const { TenDangNhap, MatKhau } = req.body;

    try {
        const [users] = await db.execute(
            `SELECT ma_nguoi_dung as ID, ten_dang_nhap as TenDangNhap
             FROM nguoi_dung
             WHERE ten_dang_nhap = ? AND mat_khau = ? AND trang_thai = 1`,
            [TenDangNhap, MatKhau]
        );

        const user = users[0];

        if (user) {
            const [roleRows] = await db.execute(`
                SELECT r.ma_role, r.role_name 
                FROM nguoi_dung_role ndr
                JOIN role r ON ndr.ma_role = r.ma_role
                WHERE ndr.ma_nguoi_dung = ?
            `, [user.ID]);
            
            const roles = roleRows.map(r => normalizeRoleName(r.role_name));

            const [permissionRows] = await db.execute(`
                SELECT DISTINCT rq.ma_quyen 
                FROM nguoi_dung_role ndr
                JOIN role_quyen rq ON ndr.ma_role = rq.ma_role
                WHERE ndr.ma_nguoi_dung = ?
            `, [user.ID]);

            const permissions = permissionRows.map(p => p.ma_quyen);

            const userInfo = {
                id: user.ID,
                username: user.TenDangNhap,
                roles: roles,
                permissions: permissions
            };

            const token = signUserToken(userInfo);

            await db.execute(
                `INSERT INTO log_he_thong (ma_nguoi_dung_tao, log_type, mo_ta, acknowledged)
                 VALUES (?, 'LOGIN', 'Người dùng đăng nhập thành công', 1)`,
                [user.ID]
            );

            res.json({
                status: 'success',
                message: 'Đăng nhập thành công',
                token,
                user: userInfo
            });
        } else {
            res.status(401).json({ status: 'error', message: 'Sai tài khoản, mật khẩu hoặc bị khóa' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ==========================================
// API: LẤY THÔNG TIN ME (SAU ĐĂNG NHẬP)
// ==========================================
router.get('/me', requireAuth, async (req, res) => {
    res.json({
        status: 'success',
        user: {
            ID: req.user.id,
            TenDangNhap: req.user.username,
            roles: req.user.roles,
            permissions: req.user.permissions
        }
    });
});
// router.get('/me', requireAuth, async (req, res) => {
//     try {
//         // Vì token (nằm trong req.user) đã chứa sẵn permissions khi login,
//         // bạn chỉ cần trả về toàn bộ req.user là được.
//         res.json({
//             status: 'success',
//             user: req.user // Trả về đầy đủ { id, username, roles, permissions }
//         });
//     } catch (error) {
//         res.status(500).json({ status: 'error', message: error.message });
//     }
// });

module.exports = router;