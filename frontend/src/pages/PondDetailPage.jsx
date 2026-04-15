import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SensorChart from '../components/SensorChart';
import { getPondConfig } from '../services/api';

const PondDetailPage = () => {
  const { id } = useParams();
  const [pondConfig, setPondConfig] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Hàm lấy dữ liệu
    const fetchData = () => {
      getPondConfig(id).then(data => setPondConfig(data));
    };

    fetchData();
    // Tùy chọn: Tự động cập nhật con số mỗi 5 giây
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (!pondConfig) return <div>Đang tải dữ liệu ao...</div>;

  return (
    <div className="panel">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)}>← Quay lại</button>
      </div>
      
      <h2>Chi tiết Ao nuôi: {id}</h2>

      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {pondConfig.configs.map(sensor => (
          <div key={sensor.ma_cam_bien} className="sensor-container" style={{ border: '1px solid #eee', padding: '15px', borderRadius: '10px', background: '#fff' }}>
            
            {/* Hiển thị con số ở đây */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '1.1em' }}>{sensor.LoaiCamBien}</strong>
              <span style={{ 
                fontSize: '1.5em', 
                fontWeight: 'bold', 
                color: '#1890ff',
                padding: '4px 10px',
                background: '#e6f7ff',
                borderRadius: '5px'
              }}>
                {sensor.latest_value ? sensor.latest_value.toFixed(1) : '--'} 
                {/* ToFixed(1) để lấy 1 chữ số thập phân, VD: 28.5 */}
              </span>
            </div>

            {/* Biểu đồ bên dưới */}
            <SensorChart 
              deviceId={sensor.ma_cam_bien} 
              label={sensor.LoaiCamBien} 
            />
            
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: '5px' }}>
              Ngưỡng an toàn: {sensor.min_value} - {sensor.max_value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PondDetailPage;