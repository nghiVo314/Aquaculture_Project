// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { getDashboardSummary, getLatestSensors, getAlerts, acknowledgeAlert } from '../services/api';
import SensorCard from '../components/Sensors/SensorCard';

const DashboardPage = () => {
    const [summary, setSummary] = useState(null);
    const [sensors, setSensors] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [summaryData, sensorsData, alertsData] = await Promise.all([
                getDashboardSummary(),
                getLatestSensors(),
                getAlerts('unacknowledged') // Chỉ lấy cảnh báo chưa xử lý
            ]);
            setSummary(summaryData);
            setSensors(sensorsData);
            setAlerts(alertsData);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Cập nhật dữ liệu mỗi 30 giây
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleAckAlert = async (logId) => {
        try {
            // Giả sử User_ID hiện tại là 1 (Cần thay bằng User_ID thật từ Auth context)
            await acknowledgeAlert(logId, 1); 
            // Cập nhật lại danh sách cảnh báo
            fetchData();
            alert("Đã xác nhận xử lý cảnh báo!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    };

    if (loading) return <h2>Đang tải dữ liệu hệ thống...</h2>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Dashboard Quản Lý Ao Nuôi</h1>

            {/* Phần 1: Thống kê tổng quan */}
            <section>
                <h2>Tổng quan</h2>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <SummaryBox title="Khu vực" value={summary?.cards?.khuvuc} />
                    <SummaryBox title="Vụ nuôi" value={summary?.cards?.vunuoi} />
                    <SummaryBox title="Ao nuôi" value={summary?.cards?.aonuoi} />
                    <SummaryBox title="Tổng diện tích" value={`${summary?.cards?.total_area} m²`} />
                    <SummaryBox 
                        title="Cảnh báo chưa xử lý" 
                        value={summary?.cards?.unhandled_logs} 
                        color="#ef4444" 
                    />
                </div>
            </section>

            {/* Phần 2: Dữ liệu cảm biến mới nhất */}
            <section style={{ marginTop: '40px' }}>
                <h2>Dữ liệu quan trắc mới nhất</h2>
                <div style={{ display: 'flex', gap: '15px', overflowX: 'auto' }}>
                    {sensors.length > 0 ? sensors.map((sensor) => (
                        <SensorCard key={sensor.ID} sensor={sensor} />
                    )) : <p>Không có dữ liệu cảm biến.</p>}
                </div>
            </section>

            {/* Phần 3: Cảnh báo hệ thống */}
            <section style={{ marginTop: '40px' }}>
                <h2>Cảnh báo cần xử lý</h2>
                {alerts.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '10px' }}>Thời gian</th>
                                <th style={{ padding: '10px' }}>Mô tả</th>
                                <th style={{ padding: '10px' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.map((alert) => (
                                <tr key={alert.ma_log} style={{ borderBottom: '1px solid #ddd' }}>
                                    <td style={{ padding: '10px' }}>
                                        {new Date(alert.thoi_gian_khoi_tao).toLocaleString('vi-VN')}
                                    </td>
                                    <td style={{ padding: '10px', color: '#ef4444' }}>{alert.mo_ta}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button 
                                            onClick={() => handleAckAlert(alert.ma_log)}
                                            style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Đã xử lý
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: '#10b981' }}>Tuyệt vời! Không có cảnh báo nào cần xử lý.</p>
                )}
            </section>
        </div>
    );
};

// Component nhỏ hỗ trợ hiển thị box tổng quan
const SummaryBox = ({ title, value, color = '#374151' }) => (
    <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', minWidth: '150px', textAlign: 'center', backgroundColor: '#fff' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6b7280' }}>{title}</h3>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>{value}</span>
    </div>
);

export default DashboardPage;