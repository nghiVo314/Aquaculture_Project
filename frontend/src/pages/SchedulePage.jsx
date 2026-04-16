import React, { useEffect, useState } from 'react';
import { getSchedules, getDevices, addSchedule, deleteSchedule, getFeedingFormulas, addFeedingFormula } from '../services/api';

const SchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [form, setForm] = useState({
    ma_tb_dieu_khien: '',
    start_time: '',
    end_time: '',
    ma_cong_thuc: ''
  });
  const [newFormula, setNewFormula] = useState({
  ma_cong_thuc: '',
  ti_le_cho_an: '',
  thong_tin_bo_sung: ''
});

  const [error, setError] = useState('');

  useEffect(() => {
    refreshData();
    loadFormulas();
  }, []);

  const refreshData = () => {
    setError('');

    getSchedules()
      .then(data => {
        const scheduleArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setSchedules(scheduleArray);
      })
      .catch(err => {
        console.error('Lỗi khi lấy lịch trình:', err);
        setSchedules([]);
      });

    getDevices()
      .then(data => {
        const deviceArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        // Chỉ lấy thiết bị điều khiển, đặc biệt là FEEDER
        setDevices(deviceArray.filter(d => d.loai_thiet_bi));
      })
      .catch(err => {
        console.error('Lỗi khi lấy thiết bị:', err);
        setDevices([]);
      });
  };

  const loadFormulas = () => {
    getFeedingFormulas()
      .then(data => {
        const formulaArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setFormulas(formulaArray);
      })
      .catch(err => {
        console.error('Lỗi khi lấy danh sách công thức:', err);
        setFormulas([]);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addSchedule(form);
      setForm({
        ma_tb_dieu_khien: '',
        start_time: '',
        end_time: '',
        ma_cong_thuc: ''
      });
      refreshData();
    } catch (err) {
      console.error('Lỗi submit form:', err);
      setError('Không thể thêm lịch trình. Vui lòng thử lại!');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSchedule(id);
      refreshData();
    } catch (err) {
      console.error('Lỗi xóa lịch trình:', err);
      setError('Không thể xóa lịch trình này.');
    }
  };

  // Hàm thêm công thức cho ăn mới
  const handleAddFormula = async (e) => {
    e.preventDefault();
    try {
      await addFeedingFormula(newFormula);
      setNewFormula({ ma_cong_thuc: '', ti_le_cho_an: '', thong_tin_bo_sung: '' });
      loadFormulas();
    } catch (err) {
      console.error('Lỗi thêm công thức:', err);
      setError('Không thể thêm công thức. Vui lòng kiểm tra lại dữ liệu hoặc quyền truy cập.');
    }
  };

  return (
    <div className="panel">
      <h2>Lịch trình tự động</h2>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      <div className="grid-two">
        <div className="card">
          <h3>Thêm lịch mới</h3>
          <form onSubmit={handleSubmit} className="mini-form">
            <select
              value={form.ma_tb_dieu_khien}
              onChange={e => setForm({ ...form, ma_tb_dieu_khien: e.target.value })}
              required
            >
              <option value="">Chọn thiết bị</option>
              {devices
                .filter(d => d.loai_thiet_bi === 'FEEDER')
                .map(d => (
                  <option key={d.ma_thiet_bi} value={d.ma_thiet_bi}>
                    {d.ma_thiet_bi}
                  </option>
                ))}
            </select>

            <select
              value={form.ma_cong_thuc}
              onChange={e => setForm({ ...form, ma_cong_thuc: e.target.value })}
              required
            >
              <option value="">Chọn công thức cho ăn</option>
              {formulas.map(f => (
                <option key={f.ma_cong_thuc} value={f.ma_cong_thuc}>
                  {f.ma_cong_thuc}
                  {f.ti_le_cho_an != null ? ` - Tỉ lệ ${f.ti_le_cho_an}` : ''}
                </option>
              ))}
            </select>

            <input
              type="time"
              value={form.start_time}
              onChange={e => setForm({ ...form, start_time: e.target.value })}
              required
            />
            <input
              type="time"
              value={form.end_time}
              onChange={e => setForm({ ...form, end_time: e.target.value })}
              required
            />
            <button type="submit">Lưu</button>
          </form>
        </div>

        <div className="card">
          <h3>Danh sách lịch trình</h3>
          <ul className="item-list">
            {schedules?.length > 0 ? (
              schedules.map(s => (
                <li key={s?.ma_lich_trinh || Math.random()}>
                  {s?.ThietBiTaiBien_ID || s?.ma_tb_dieu_khien}:
                  {' '}
                  {s?.start_time} - {s?.end_time}
                  {' '}
                  | CT: {s?.ma_cong_thuc || 'N/A'}
                  <button onClick={() => handleDelete(s.ma_lich_trinh)}>Xóa</button>
                </li>
              ))
            ) : (
              <li>Chưa có lịch trình nào.</li>
            )}
          </ul>
        </div>
        
        <div className="card">
          <h3>Thêm công thức cho ăn</h3>
          <form onSubmit={handleAddFormula} className="mini-form">
            <input
              value={newFormula.ma_cong_thuc}
              onChange={e => setNewFormula({ ...newFormula, ma_cong_thuc: e.target.value })}
              placeholder="Mã công thức"
              required
            />
            <input
              type="number"
              step="0.01"
              value={newFormula.ti_le_cho_an}
              onChange={e => setNewFormula({ ...newFormula, ti_le_cho_an: e.target.value })}
              placeholder="Tỉ lệ cho ăn"
            />
            <textarea
              value={newFormula.thong_tin_bo_sung}
              onChange={e => setNewFormula({ ...newFormula, thong_tin_bo_sung: e.target.value })}
              placeholder="Thông tin bổ sung"
            />
            <button type="submit">Thêm công thức</button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default SchedulePage;