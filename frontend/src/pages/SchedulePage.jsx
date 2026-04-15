import React, { useEffect, useState } from 'react';
import { getSchedules, getDevices, addSchedule, deleteSchedule } from '../services/api';

const SchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ ma_tb_dieu_khien: '', start_time: '', end_time: '' });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    getSchedules().then(setSchedules);
    getDevices().then(data => setDevices(data.filter(d => d.loai_thiet_bi)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addSchedule(form);
    refreshData();
  };

  return (
    <div className="panel">
      <h2>Lịch trình tự động</h2>
      <div className="grid-two">
        <div className="card">
          <h3>Thêm lịch mới</h3>
          <form onSubmit={handleSubmit} className="mini-form">
            <select onChange={e => setForm({...form, ma_tb_dieu_khien: e.target.value})} required>
              <option value="">Chọn thiết bị</option>
              {devices.map(d => <option key={d.ma_thiet_bi} value={d.ma_thiet_bi}>{d.ma_thiet_bi}</option>)}
            </select>
            <input type="time" onChange={e => setForm({...form, start_time: e.target.value})} required />
            <input type="time" onChange={e => setForm({...form, end_time: e.target.value})} required />
            <button type="submit">Lưu</button>
          </form>
        </div>
        <div className="card">
          <h3>Danh sách lịch trình</h3>
          <ul className="item-list">
            {schedules.map(s => (
              <li key={s.ma_lich_trinh}>
                {s.ThietBiTaiBien_ID}: {s.start_time} - {s.end_time}
                <button onClick={() => deleteSchedule(s.ma_lich_trinh)}>Xóa</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;