const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'simple-aquaculture-secret';

// Đã bỏ ROLE_ALIAS vì hệ thống mới quản lý bằng Quyền (Permissions) thay vì Tên Role tĩnh

// Hàm chuẩn hóa text (có thể giữ lại nếu dùng cho mục đích khác, nhưng không bắt buộc)
function normalizeText(value = '') {
    return String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ==========================================
// KÝ TOKEN VỚI MẢNG ROLES & PERMISSIONS
// ==========================================
function signUserToken(user) {
    return jwt.sign(
        {
            id: user.id, // Lưu ý: Biến lấy từ auth.js truyền vào là user.id, không phải user.ID nữa
            username: user.username,
            roles: user.roles || [],               // Lưu mảng roles (VD: ['admin'])
            permissions: user.permissions || []    // Lưu mảng permissions (VD: ['pond:create'])
        },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
}

// ==========================================
// MIDDLEWARE KIỂM TRA ĐĂNG NHẬP
// ==========================================
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Thiếu token xác thực' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Lúc này req.user đã có .roles và .permissions
        next();
    } catch (error) {
        // THÊM DÒNG NÀY ĐỂ IN RA LỖI CHI TIẾT DƯỚI TERMINAL NODE.JS
        console.error("Lý do Token bị lỗi:", error.message, " | Token nhận được:", token);
        return res.status(401).json({ status: 'error', message: 'Token không hợp lệ hoặc hết hạn' });
    }
}

// ==========================================
// MIDDLEWARE KIỂM TRA QUYỀN HẠN CỤ THỂ (MỚI)
// ==========================================
function requirePermission(requiredPermission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: 'error', message: 'Chưa xác thực người dùng' });
        }
        
        // Kiểm tra xem trong mảng permissions của user có quyền được yêu cầu hay không
        if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thực hiện thao tác này!' });
        }
        next();
    };
}

module.exports = {
    signUserToken,
    requireAuth,
    requirePermission
};