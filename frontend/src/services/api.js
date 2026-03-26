// frontend/src/services/api.js
const API_URL = 'http://localhost:5000/api'; // Thay đổi port nếu backend của bạn dùng port khác

export const getDashboardSummary = async () => {
    const res = await fetch(`${API_URL}/dashboard/summary`);
    if (!res.ok) throw new Error('Lỗi khi lấy dữ liệu summary');
    return res.json();
};

export const getLatestSensors = async () => {
    const res = await fetch(`${API_URL}/sensors/latest`);
    if (!res.ok) throw new Error('Lỗi khi lấy dữ liệu cảm biến');
    return res.json();
};

export const getAlerts = async (status = '') => {
    const url = status ? `${API_URL}/alerts?status=${status}` : `${API_URL}/alerts`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Lỗi khi lấy danh sách cảnh báo');
    return res.json();
};

export const acknowledgeAlert = async (logId, userId) => {
    const res = await fetch(`${API_URL}/alerts/${logId}/ack`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ User_ID: userId }),
    });
    if (!res.ok) throw new Error('Lỗi khi xác nhận cảnh báo');
    return res.json();
};