import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SensorChart = ({ deviceId, label }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Đảm bảo không fetch nếu chưa có deviceId
    if (!deviceId) return;

    fetch(`http://127.0.0.1:5000/api/sensors/${deviceId}/history`)
      .then(res => res.json())
      .then(json => {
        // Đảm bảo dữ liệu là mảng trước khi set state
        if (Array.isArray(json)) {
          setData(json);
        }
      })
      .catch(err => console.error("Lỗi khi tải dữ liệu biểu đồ:", err));
  }, [deviceId]);

  // Hàm format thời gian cho trục X (Ví dụ: "09:40" hoặc "15/04 09:40")
  const formatXAxis = (tickItem) => {
    if (!tickItem) return '';
    const date = new Date(tickItem);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="card" style={{ height: '300px', padding: '10px' }}>
      <h4>Biểu đồ {label}</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="thoi_gian" 
            tick={{ fontSize: 12 }} 
            tickFormatter={formatXAxis} // Rút gọn thời gian hiển thị
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            labelFormatter={(label) => new Date(label).toLocaleString()} // Tooltip hiển thị đầy đủ ngày giờ
          />
          <Line 
            type="monotone" 
            dataKey="gia_tri" 
            stroke="#8884d8" 
            strokeWidth={2}
            dot={false} 
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SensorChart;