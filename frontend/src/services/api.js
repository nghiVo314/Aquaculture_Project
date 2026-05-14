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

export const getDashboardSummary = () => request('/dashboard/summary');
export const getLatestSensors = () => request('/sensors/latest');
export const getAlerts = (status = '', options = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (options.pondId) params.set('pond_id', options.pondId);
    if (options.sort) params.set('sort', options.sort);
    if (options.days) params.set('days', String(options.days));
    const query = params.toString();
    return request(`/alerts${query ? `?${query}` : ''}`);
};
export const getPondAlerts = (pondId, status = 'unacknowledged', options = {}) => {
    const params = new URLSearchParams();
    params.set('pond_id', pondId);
    if (status) params.set('status', status);
    if (options.sort) params.set('sort', options.sort);
    if (options.days) params.set('days', String(options.days));
    return request(`/alerts?${params.toString()}`);
};
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
export const updatePond = (id, payload) => request(`/ponds/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deletePond = (id) => request(`/ponds/${id}`, { method: 'DELETE' });

export const getStations = () => request('/devices/stations');
export const addStation = (payload) => request('/devices/stations', { method: 'POST', body: JSON.stringify(payload) });
export const deleteStation = (id) => request(`/devices/stations/${id}`, { method: 'DELETE' });

export const getDevices = () => request('/devices/inventory');
export const addDevice = (payload) => request('/devices/inventory', { method: 'POST', body: JSON.stringify(payload) });
export const deleteDevice = (id) => request(`/devices/inventory/${id}`, { method: 'DELETE' });

export const getSystemLogs = () => request('/logs');

// Cấu hình Ao (Luật tự động)
export const getPondConfig = (aoId) => request(`/ponds/${aoId}/config`);

export const getThresholdHistory = (aoId) => request(`/ponds/${aoId}/config/history`);

export const updatePondConfig = (aoId, payload) =>
    request(`/ponds/${aoId}/config`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });

// Điều khiển Thiết bị
export const updateDeviceStatus = (deviceId, trang_thai) =>
    request(`/devices/${deviceId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ trang_thai })
    });

// Quản lý User
export const getUsers = () => request('/users');

export const getManagers = () => request('/users/managers');
export const getWorkers = () => request('/users/workers');
export const getWorkerWorkload = () => request('/users/workers/workload/stats');

export const getPondWorkers = (pondId) => request(`/ponds/${pondId}/workers`);
export const addPondWorker = (pondId, payload) =>
    request(`/ponds/${pondId}/workers`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
export const removePondWorker = (pondId, workerId) =>
    request(`/ponds/${pondId}/workers/${workerId}`, {
        method: 'DELETE'
    });
export const updatePondWorkerRole = (pondId, workerId, payload) =>
    request(`/ponds/${pondId}/workers/${workerId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });

export const updateUserAreas = (userId, khuvuc_ids) =>
    request(`/users/${userId}/areas`, {
        method: 'PUT',
        body: JSON.stringify({ khuvuc_ids })
    });

// Lịch trình
export const getSchedules = () => request('/devices');

// Báo cáo & Lịch sử cảm biến
export const getSensorHistory = (deviceId) =>
    request(`/sensors/${deviceId}/history`);

// Thêm lịch trình mới
export const addSchedule = (payload) =>
    request('/devices/schedules', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

export const suggestSchedules = (payload) =>
    request('/devices/schedules/suggest', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

// Xóa lịch trình
export const deleteSchedule = (id) =>
    request(`/devices/schedules/${id}`, {
        method: 'DELETE',
    });

//gọi lịch sử cho ăn
export const getFeedingHistory = () => request('/devices/feeding-history');

// Cập nhật chế độ hoạt động của ao (AUTO/MANUAL)
export const updatePondMode = async (pondId, mode) => {
    return request(`/ponds/${pondId}/mode`, {
        method: 'PUT',
        body: JSON.stringify({ che_do: mode })
    });
};

export const getFeedingFormulas = () => request('/devices/feeding-formulas');

// Thêm công thức cho ăn mới
export const addFeedingFormula = (payload) =>
    request('/devices/feeding-formulas', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

// Xóa công thức cho ăn
export const deleteFeedingFormula = (id) =>
    request(`/devices/feeding-formulas/${id}`, {
        method: 'DELETE',
    });

export const createUser = (payload) =>
    request('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

export const updateUserRole = (userId, ma_role) =>
    request(`/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ ma_role })
    });

export const getReportSensors = (days = 7) =>
    request(`/ponds/sensor-report?days=${days}`);

// Xóa người dùng
export const deleteUserByAdmin = (userId, ly_do_xoa) =>
    request(`/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify({ ly_do_xoa })
    });