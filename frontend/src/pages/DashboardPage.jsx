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
        // Cập nhật dữ liệu mỗi 3 giây
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleAckAlert = async (logId) => {
        try {
            await acknowledgeAlert(logId, 1); 
            fetchData();
            alert("Đã xác nhận xử lý cảnh báo!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        }
    };

    // LOGIC: Lọc và gom nhóm cảm biến

    // 1. LỌC BỎ TRÙNG LẶP: Chỉ giữ lại 1 giá trị mới nhất cho mỗi mã cảm biến
    const uniqueSensorsMap = {};
    sensors.forEach(sensor => {
        // Vì dữ liệu API đã sắp xếp từ mới nhất -> cũ nhất, 
        // ta chỉ cần lấy lần xuất hiện đầu tiên của mỗi cảm biến là chuẩn nhất.
        if (!uniqueSensorsMap[sensor.ThietBiTaiBien_ID]) {
            uniqueSensorsMap[sensor.ThietBiTaiBien_ID] = sensor;
        }
    });
    const uniqueSensors = Object.values(uniqueSensorsMap);

    // 2. GOM NHÓM: Phân loại các cảm biến đã lọc vào từng Ao
    const groupedSensors = uniqueSensors.reduce((acc, sensor) => {
        // Tách chuỗi CB_DO_01 lấy số 01
        const parts = sensor.ThietBiTaiBien_ID.split('_');
        const pondId = parts[parts.length - 1]; 

        if (!acc[pondId]) acc[pondId] = [];
        acc[pondId].push(sensor);
        return acc;
    }, {});

    // Sắp xếp thứ tự các Ao (Ao 01, Ao 02...)
    const sortedPondIds = Object.keys(groupedSensors).sort();

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

            {/* Phần 2: Dữ liệu cảm biến mới nhất (ĐÃ CHIA THEO AO) */}
            <section style={{ marginTop: '40px' }}>
                <h2>Dữ liệu quan trắc (Cập nhật liên tục)</h2>
                
                {sortedPondIds.length > 0 ? sortedPondIds.map(pondId => {
                    // Sắp xếp các cảm biến trong 1 ao theo tên (DO -> PH -> TEMP) để chúng không nhảy vị trí
                    const pondSensors = groupedSensors[pondId].sort((a, b) => 
                        a.ThietBiTaiBien_ID.localeCompare(b.ThietBiTaiBien_ID)
                    );

                    return (
                        <div key={pondId} style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <h3 style={{ marginTop: 0, color: '#2563eb', borderBottom: '2px solid #bfdbfe', paddingBottom: '10px', display: 'inline-block' }}>
                                Khu vực Ao số {parseInt(pondId, 10)}
                            </h3>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                {pondSensors.map((sensor) => (
                                    // SỬ DỤNG sensor.ThietBiTaiBien_ID LÀM KEY ĐỂ CHỐNG NHẤP NHÁY
                                    <SensorCard key={sensor.ThietBiTaiBien_ID} sensor={sensor} />
                                ))}
                            </div>
                        </div>
                    );
                }) : <p>Không có dữ liệu cảm biến.</p>}
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

const SummaryBox = ({ title, value, color = '#374151' }) => (
    <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', minWidth: '150px', textAlign: 'center', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6b7280' }}>{title}</h3>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>{value || 0}</span>
    </div>
);

export default DashboardPage;
















// // frontend/src/pages/DashboardPage.jsx
// import React, { useState, useEffect } from 'react';
// import { getDashboardSummary, getLatestSensors, getAlerts, acknowledgeAlert } from '../services/api';
// import SensorCard from '../components/Sensors/SensorCard';

// const DashboardPage = () => {
//     const [summary, setSummary] = useState(null);
//     const [sensors, setSensors] = useState([]);
//     const [alerts, setAlerts] = useState([]);
//     const [loading, setLoading] = useState(true);

//     const fetchData = async () => {
//         try {
//             const [summaryData, sensorsData, alertsData] = await Promise.all([
//                 getDashboardSummary(),
//                 getLatestSensors(),
//                 getAlerts('unacknowledged') // Chỉ lấy cảnh báo chưa xử lý
//             ]);
//             setSummary(summaryData);
//             setSensors(sensorsData);
//             setAlerts(alertsData);
//         } catch (error) {
//             console.error("Lỗi khi tải dữ liệu:", error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         fetchData();
//         // Cập nhật dữ liệu mỗi 30 giây
//         const interval = setInterval(fetchData, 3000);
//         return () => clearInterval(interval);
//     }, []);

//     const handleAckAlert = async (logId) => {
//         try {
//             // Giả sử User_ID hiện tại là 1 (Cần thay bằng User_ID thật từ Auth context)
//             await acknowledgeAlert(logId, 1); 
//             // Cập nhật lại danh sách cảnh báo
//             fetchData();
//             alert("Đã xác nhận xử lý cảnh báo!");
//         } catch (error) {
//             alert("Lỗi: " + error.message);
//         }
//     };

//     if (loading) return <h2>Đang tải dữ liệu hệ thống...</h2>;

//     return (
//         <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
//             <h1>Dashboard Quản Lý Ao Nuôi</h1>

//             {/* Phần 1: Thống kê tổng quan */}
//             <section>
//                 <h2>Tổng quan</h2>
//                 <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
//                     <SummaryBox title="Khu vực" value={summary?.cards?.khuvuc} />
//                     <SummaryBox title="Vụ nuôi" value={summary?.cards?.vunuoi} />
//                     <SummaryBox title="Ao nuôi" value={summary?.cards?.aonuoi} />
//                     <SummaryBox title="Tổng diện tích" value={`${summary?.cards?.total_area} m²`} />
//                     <SummaryBox 
//                         title="Cảnh báo chưa xử lý" 
//                         value={summary?.cards?.unhandled_logs} 
//                         color="#ef4444" 
//                     />
//                 </div>
//             </section>

//             {/* Phần 2: Dữ liệu cảm biến mới nhất */}
//             <section style={{ marginTop: '40px' }}>
//                 <h2>Dữ liệu quan trắc mới nhất</h2>
//                 <div style={{ display: 'flex', gap: '15px', overflowX: 'auto' }}>
//                     {sensors.length > 0 ? sensors.map((sensor) => (
//                         <SensorCard key={sensor.ID} sensor={sensor} />
//                     )) : <p>Không có dữ liệu cảm biến.</p>}
//                 </div>
//             </section>

//             {/* Phần 3: Cảnh báo hệ thống */}
//             <section style={{ marginTop: '40px' }}>
//                 <h2>Cảnh báo cần xử lý</h2>
//                 {alerts.length > 0 ? (
//                     <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
//                         <thead>
//                             <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #ddd' }}>
//                                 <th style={{ padding: '10px' }}>Thời gian</th>
//                                 <th style={{ padding: '10px' }}>Mô tả</th>
//                                 <th style={{ padding: '10px' }}>Hành động</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {alerts.map((alert) => (
//                                 <tr key={alert.ma_log} style={{ borderBottom: '1px solid #ddd' }}>
//                                     <td style={{ padding: '10px' }}>
//                                         {new Date(alert.thoi_gian_khoi_tao).toLocaleString('vi-VN')}
//                                     </td>
//                                     <td style={{ padding: '10px', color: '#ef4444' }}>{alert.mo_ta}</td>
//                                     <td style={{ padding: '10px' }}>
//                                         <button 
//                                             onClick={() => handleAckAlert(alert.ma_log)}
//                                             style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
//                                         >
//                                             Đã xử lý
//                                         </button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 ) : (
//                     <p style={{ color: '#10b981' }}>Tuyệt vời! Không có cảnh báo nào cần xử lý.</p>
//                 )}
//             </section>
//         </div>
//     );
// };

// // Component nhỏ hỗ trợ hiển thị box tổng quan
// const SummaryBox = ({ title, value, color = '#374151' }) => (
//     <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', minWidth: '150px', textAlign: 'center', backgroundColor: '#fff' }}>
//         <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6b7280' }}>{title}</h3>
//         <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>{value}</span>
//     </div>
// );

// export default DashboardPage;