const API_URL = 'http://localhost:5000/api';
const TOKEN_KEY = 'aq_token';

async function request(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.message || body.error || 'Yeu cau that bai');
    }

    return body;
}

export const loginApi = (TenDangNhap, MatKhau) =>
    request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ TenDangNhap, MatKhau })
    });

export const registerApi = ({ TenDangNhap, MatKhau, RoleName }) =>
    request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ TenDangNhap, MatKhau, RoleName })
    });

// export const getDashboardSummary = () => request('/dashboard/summary');
export const getLatestSensors = () => request('/sensors/latest');
export const getAlerts = (status = '') => request(`/alerts${status ? `?status=${status}` : ''}`);
export const acknowledgeAlert = (logId, userId) =>
    request(`/alerts/${logId}/ack`, {
        method: 'PUT',
        body: JSON.stringify({ User_ID: userId })
    });

export const getZones = () => request('/zones');
export const addZone = (payload) => request('/zones', { method: 'POST', body: JSON.stringify(payload) });
export const updateZone = (id, payload) => request(`/zones/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteZone = (id) => request(`/zones/${id}`, { method: 'DELETE' });

export const getPonds = () => request('/ponds');
export const addPond = (payload) => request('/ponds', { method: 'POST', body: JSON.stringify(payload) });
export const deletePond = (id) => request(`/ponds/${id}`, { method: 'DELETE' });

export const getStations = () => request('/devices/stations');
export const addStation = (payload) => request('/devices/stations', { method: 'POST', body: JSON.stringify(payload) });
export const deleteStation = (id) => request(`/devices/stations/${id}`, { method: 'DELETE' });

export const getDevices = () => request('/devices/inventory');
export const addDevice = (payload) => request('/devices/inventory', { method: 'POST', body: JSON.stringify(payload) });
export const deleteDevice = (id) => request(`/devices/inventory/${id}`, { method: 'DELETE' });

export const getSystemLogs = () => request('/logs');


// Thêm vào file services/api.js hiện tại của bạn

// Dashboard
export const getDashboardSummary = async () => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch('http://127.0.0.1:5000/api/dashboard/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Lỗi tải dữ liệu Dashboard');
    return res.json();
};

// Cấu hình Ao (Luật tự động)
export const getPondConfig = async (aoId) => {
    const res = await fetch(`http://127.0.0.1:5000/api/ponds/${aoId}/config`);
    if (!res.ok) throw new Error('Lỗi tải cấu hình ao');
    return res.json();
};

export const updatePondConfig = async (aoId, payload) => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch(`http://127.0.0.1:5000/api/ponds/${aoId}/config`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload) // { LoaiCamBien, min_value, max_value }
    });
    if (!res.ok) throw new Error('Lỗi cập nhật cấu hình');
    return res.json();
};

// Điều khiển Thiết bị
export const updateDeviceStatus = async (deviceId, trang_thai) => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch(`http://127.0.0.1:5000/api/devices/${deviceId}/status`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ trang_thai }) // 'HOAT_DONG' hoặc 'TAT'
    });
    if (!res.ok) throw new Error('Lỗi điều khiển thiết bị');
    return res.json();
};

// Quản lý User
export const getUsers = async () => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch('http://127.0.0.1:5000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
};

export const updateUserAreas = async (userId, khuvuc_ids) => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch(`http://127.0.0.1:5000/api/users/${userId}/areas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ khuvuc_ids })
    });
    return res.json();
};

// Lịch trình
export const getSchedules = async () => {
    const res = await fetch('http://127.0.0.1:5000/api/devices'); // Route mặc định lấy lịch trình
    return res.json();
};

// Báo cáo & Lịch sử cảm biến
export const getSensorHistory = async (deviceId, days = 7) => {
    const res = await fetch(`http://127.0.0.1:5000/api/sensors/history?device_id=${deviceId}&days=${days}`);
    return res.json();
};

// Thêm lịch trình mới
export const addSchedule = async (payload) => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch('http://127.0.0.1:5000/api/devices/schedules', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload) // { ma_tb_dieu_khien, start_time, end_time }
    });
    if (!res.ok) throw new Error('Lỗi thêm lịch trình');
    return res.json();
};

// Xóa lịch trình
export const deleteSchedule = async (id) => {
    const token = localStorage.getItem('aq_token');
    const res = await fetch(`http://127.0.0.1:5000/api/devices/schedules/${id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${token}` 
        }
    });
    if (!res.ok) throw new Error('Lỗi xóa lịch trình');
    return res.json();
};