import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { CSVLink } from 'react-csv';
import { getZones, getPonds } from '../services/api';

const ReportPage = () => {
  const [reportData, setReportData] = useState([]); // Dữ liệu giả lập hoặc lấy từ API history
  const [viewType, setViewType] = useState('chart');

  // Dữ liệu mô phỏng để test báo cáo đa chiều
  const mockData = [
    { time: '00:00', AO_01: 5.5, AO_02: 6.0, AO_03: 5.2 },
    { time: '04:00', AO_01: 4.8, AO_02: 5.5, AO_03: 4.5 },
    { time: '08:00', AO_01: 6.2, AO_02: 6.8, AO_03: 5.9 },
    { time: '12:00', AO_01: 7.5, AO_02: 7.2, AO_03: 6.5 },
    { time: '16:00', AO_01: 6.8, AO_02: 7.0, AO_03: 6.2 },
    { time: '20:00', AO_01: 5.9, AO_02: 6.5, AO_03: 5.5 },
  ];

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Hệ thống Báo cáo Động</h2>
        <CSVLink data={mockData} filename={"bao-cao-thuy-san.csv"} className="btn-primary">
          Xuất file Excel (CSV)
        </CSVLink>
      </div>

      <div className="filter-bar" style={{ margin: '20px 0', display: 'flex', gap: '15px' }}>
        <select><option>Tất cả ao</option></select>
        <select><option>7 ngày qua</option></select>
        <button onClick={() => setViewType(viewType === 'chart' ? 'table' : 'chart')}>
          {viewType === 'chart' ? 'Xem dạng bảng' : 'Xem dạng biểu đồ'}
        </button>
      </div>

      {viewType === 'chart' ? (
        <div className="card" style={{ height: '400px', padding: '20px' }}>
          <h3>Biến động Oxy hòa tan (DO) giữa các ao</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: 'mg/L', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="AO_01" stroke="#8884d8" name="Ao 1" />
              <Line type="monotone" dataKey="AO_02" stroke="#82ca9d" name="Ao 2" />
              <Line type="monotone" dataKey="AO_03" stroke="#ffc658" name="Ao 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <table className="report-table" style={{ width: '100%', border: '1px solid #ddd' }}>
          <thead>
            <tr><th>Thời gian</th><th>Ao 1 (mg/L)</th><th>Ao 2 (mg/L)</th><th>Ao 3 (mg/L)</th></tr>
          </thead>
          <tbody>
            {mockData.map((d, i) => (
              <tr key={i}><td>{d.time}</td><td>{d.AO_01}</td><td>{d.AO_02}</td><td>{d.AO_03}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReportPage;