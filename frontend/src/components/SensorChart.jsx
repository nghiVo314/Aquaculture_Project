import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getSensorHistory } from '../services/api';

const SensorChart = ({ deviceId, label }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!deviceId) {
      setData([]);
      return undefined;
    }

    let cancelled = false;

    const loadHistory = async () => {
      try {
        const rows = await getSensorHistory(deviceId);
        if (!cancelled) {
          setData(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Lỗi khi tải dữ liệu biểu đồ:', error);
        }
      }
    };

    loadHistory();
    const intervalId = setInterval(loadHistory, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [deviceId]);

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
            tickFormatter={formatXAxis}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip labelFormatter={(chartLabel) => new Date(chartLabel).toLocaleString('vi-VN')} />
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
