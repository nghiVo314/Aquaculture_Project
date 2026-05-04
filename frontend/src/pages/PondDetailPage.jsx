import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SensorChart from '../components/SensorChart';
import { 
  getPonds, 
  getDevices, 
  getPondConfig, 
  updateDeviceStatus, 
  updatePondConfig, 
  updatePondMode, 
  getFeedingHistory, 
  getSchedules, 
  addSchedule, 
  deleteSchedule, 
  getFeedingFormulas, 
  addFeedingFormula,
  deleteFeedingFormula,
  getPondAlerts,
  acknowledgeAlert,
  suggestSchedules
} from '../services/api';

const PondDetailPage = () => {
  const { id } = useParams(); // id chính là ma_ao_nuoi
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // States Dữ liệu
  const [pondData, setPondData] = useState(null);
  const [pondConfig, setPondConfig] = useState(null);
  const [devices, setDevices] = useState([]);
  const [pondMode, setPondMode] = useState('AUTO');
  const [schedules, setSchedules] = useState([]);
  const [feedingHistory, setFeedingHistory] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suggestedSchedules, setSuggestedSchedules] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // States Form
  const [scheduleForm, setScheduleForm] = useState({ ma_tb_dieu_khien: '', start_time: '', end_time: '', ma_cong_thuc: '' });
  const [formulaForm, setFormulaForm] = useState({ ma_cong_thuc: '', ti_le_cho_an: '', thong_tin_bo_sung: '' });
  const [error, setError] = useState('');

  // 1. TẢI VÀ LỌC DỮ LIỆU BAN ĐẦU THEO AO CỤ THỂ
  useEffect(() => {
    let intervalId;

    const fetchInitialData = async () => {
      try {
        // Tải config cảm biến
        const configData = await getPondConfig(id);
        setPondConfig(configData);

        // Tải danh sách ao, thiết bị và công thức
        const [allPonds, allDevices, allFormulas] = await Promise.all([
          getPonds(),
          getDevices(),
          getFeedingFormulas()
        ]);

        // Tìm ao hiện tại
        const currentPond = allPonds.find(p => p.ma_ao_nuoi === id);
        if (!currentPond) {
          setError('Không tìm thấy thông tin ao nuôi!');
          return;
        }
        setPondData(currentPond);
        setPondMode(currentPond.che_do || 'AUTO');

        // Lọc thiết bị thuộc trạm của ao này
        const currentPondDevices = allDevices.filter(d => d.ma_tram === currentPond.ma_tram);
        setDevices(currentPondDevices);

        // Set danh sách công thức
        setFormulas(Array.isArray(allFormulas) ? allFormulas : (allFormulas?.data || []));

        // Tải lịch trình & lịch sử cho các thiết bị của ao này
        await refreshDynamicData(currentPondDevices);
        await loadPondAlerts();

        // Đặt interval cập nhật dữ liệu động (Cảm biến & Lịch sử) mỗi 5s
        intervalId = setInterval(() => {
          getPondConfig(id).then(setPondConfig).catch(console.error);
          refreshDynamicData(currentPondDevices);
          loadPondAlerts();
        }, 5000);

      } catch (err) {
        console.error("Lỗi tải dữ liệu ao:", err);
        setError("Có lỗi xảy ra khi tải dữ liệu.");
      }
    };

    fetchInitialData();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [id]);

  // Hàm tải lại Lịch trình & Lịch sử cho ăn (được lọc theo thiết bị của ao)
  const refreshDynamicData = async (pondDevices) => {
    try {
      const deviceIds = pondDevices.map(d => d.ma_thiet_bi);
      const [allSchedules, allHistory] = await Promise.all([
        getSchedules().catch(() => []),
        getFeedingHistory().catch(() => [])
      ]);

      const schedArray = Array.isArray(allSchedules) ? allSchedules : (allSchedules?.data || []);
      const histArray = Array.isArray(allHistory) ? allHistory : (allHistory?.data || []);

      setSchedules(schedArray.filter(s => deviceIds.includes(s.ma_tb_dieu_khien || s.ThietBiTaiBien_ID)));
      setFeedingHistory(histArray.filter(h => deviceIds.includes(h.ma_tb_dieu_khien)));
    } catch (err) {
      console.error("Lỗi refresh dữ liệu động:", err);
    }
  };

  const loadPondAlerts = async () => {
    try {
      const rows = await getPondAlerts(id, 'unacknowledged');
      setAlerts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Lỗi tải cảnh báo ao:', err);
    }
  };

  // 2. CÁC HÀM XỬ LÝ (HANDLERS)
  const handleToggleMode = async () => {
    const newMode = pondMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    try {
      await updatePondMode(id, newMode);
      setPondMode(newMode);
      alert(`Đã chuyển ao ${id} sang chế độ ${newMode}`);
    } catch (err) {
      alert("Lỗi chuyển chế độ: " + err.message);
    }
  };

  const handleToggleDevice = async (deviceId, currentStatus) => {
    if (pondMode === 'AUTO') {
      alert("Vui lòng chuyển ao sang chế độ MANUAL trước khi điều khiển thủ công!");
      return;
    }
    const newStatus = currentStatus === 'HOAT_DONG' ? 'TAT' : 'HOAT_DONG';
    try {
      await updateDeviceStatus(deviceId, newStatus);
      setDevices(devices.map(d => d.ma_thiet_bi === deviceId ? { ...d, trang_thai: newStatus } : d));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveRule = async (LoaiCamBien, min_value, max_value) => {
    try {
      await updatePondConfig(id, { LoaiCamBien, min_value: Number(min_value), max_value: Number(max_value) });
      alert(`Đã cập nhật ngưỡng cho ${LoaiCamBien}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    try {
      await addSchedule(scheduleForm);
      setScheduleForm({ ma_tb_dieu_khien: '', start_time: '', end_time: '', ma_cong_thuc: '' });
      refreshDynamicData(devices);
      alert('Thêm lịch trình thành công!');
    } catch (err) {
      alert('Lỗi thêm lịch trình: ' + err.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await deleteSchedule(scheduleId);
      refreshDynamicData(devices);
    } catch (err) {
      alert('Không thể xóa lịch trình: ' + err.message);
    }
  };

  const handleSuggestSchedule = async () => {
    if (!scheduleForm.ma_tb_dieu_khien) {
      alert('Vui lòng chọn thiết bị điều khiển trước khi gợi ý lịch.');
      return;
    }
    setSuggestLoading(true);
    try {
      const response = await suggestSchedules({
        ao_id: id,
        ma_tb_dieu_khien: scheduleForm.ma_tb_dieu_khien
      });
      setSuggestedSchedules(response.suggestions || []);
    } catch (err) {
      alert('Không thể gợi ý lịch: ' + err.message);
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleApplySuggested = async (item) => {
    try {
      await addSchedule({
        ma_tb_dieu_khien: item.ma_tb_dieu_khien,
        start_time: item.start_time,
        end_time: item.end_time,
        ma_cong_thuc: scheduleForm.ma_cong_thuc || null
      });
      await refreshDynamicData(devices);
      alert(`Đã áp dụng lịch ${item.start_time} - ${item.end_time}`);
    } catch (err) {
      alert('Không thể áp dụng lịch: ' + err.message);
    }
  };

  const handleAckAlert = async (logId) => {
    try {
      await acknowledgeAlert(logId);
      await loadPondAlerts();
    } catch (err) {
      alert('Không thể xác nhận cảnh báo: ' + err.message);
    }
  };

  const handleAddFormula = async (e) => {
    e.preventDefault();
    try {
      await addFeedingFormula(formulaForm);
      setFormulaForm({ ma_cong_thuc: '', ti_le_cho_an: '', thong_tin_bo_sung: '' });
      const newFormulas = await getFeedingFormulas();
      setFormulas(Array.isArray(newFormulas) ? newFormulas : (newFormulas?.data || []));
      alert('Thêm công thức thành công!');
    } catch (err) {
      alert('Lỗi thêm công thức: ' + err.message);
    }
  };

const handleDeleteFormula = async (formulaId) => {
  if (!window.confirm(`Bạn có chắc chắn muốn xóa công thức ${formulaId}?`)) return;
  
  try {
    await deleteFeedingFormula(formulaId);
    // Cập nhật lại danh sách công thức sau khi xóa
    const newFormulas = await getFeedingFormulas();
    setFormulas(Array.isArray(newFormulas) ? newFormulas : (newFormulas?.data || []));
    alert('Đã xóa công thức thành công!');
  } catch (err) {
    alert('Không thể xóa công thức: ' + err.message);
  }
};

  if (!pondConfig) return <div>Đang tải dữ liệu ao...</div>;

  const controlDevices = devices.filter(d => d.loai_thiet_bi !== null);
  const controllableDevices = devices.filter(d => d.loai_thiet_bi !== null);

  return (
    <div className="panel">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', cursor: 'pointer' }}>← Quay lại</button>
        <h2 style={{ margin: 0 }}>Quản lý Ao: {id} {pondData ? `(Trạm ${pondData.ma_tram})` : ''}</h2>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      {/* --- PHẦN 1: GIÁM SÁT CẢM BIẾN --- */}
      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {pondConfig.configs.map(sensor => (
          <div key={sensor.ma_cam_bien} className="sensor-container" style={{ border: '1px solid #eee', padding: '15px', borderRadius: '10px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '1.1em' }}>{sensor.LoaiCamBien}</strong>
              <span
                style={{
                  fontSize: '0.85em',
                  padding: '4px 8px',
                  borderRadius: '999px',
                  color: '#fff',
                  background: Number(sensor.latest_value) > Number(sensor.max_value) || Number(sensor.latest_value) < Number(sensor.min_value) ? '#d4380d' : '#2f9e44'
                }}
              >
                {Number(sensor.latest_value) > Number(sensor.max_value) || Number(sensor.latest_value) < Number(sensor.min_value) ? 'Vượt ngưỡng' : 'Ổn định'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#1890ff', padding: '4px 10px', background: '#e6f7ff', borderRadius: '5px' }}>
                {sensor.latest_value ? sensor.latest_value.toFixed(1) : '--'} 
              </span>
              <span style={{ color: '#666', fontSize: '0.9em' }}>
                Min {sensor.min_value} - Max {sensor.max_value}
              </span>
            </div>
            <SensorChart deviceId={sensor.ma_cam_bien} label={sensor.LoaiCamBien} />
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: '5px' }}>
              Ngưỡng an toàn: {sensor.min_value} - {sensor.max_value}
            </div>
          </div>
        ))}
      </div>

      <hr style={{ margin: '30px 0', borderColor: '#eee' }} />

      {/* --- PHẦN 2: BẢNG ĐIỀU KHIỂN & TỰ ĐỘNG HÓA --- */}
      <h3>Bảng Điều khiển Thiết bị</h3>
      <div style={{ marginBottom: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <h4 style={{ margin: 0 }}>Chế độ ao hiện tại:</h4>
        <button 
          onClick={handleToggleMode}
          style={{ backgroundColor: pondMode === 'AUTO' ? '#2196F3' : '#FF9800', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {pondMode === 'AUTO' ? 'TỰ ĐỘNG (AUTO)' : 'THỦ CÔNG (MANUAL)'}
        </button>
        <span style={{ color: '#555', fontSize: '14px' }}>
          {pondMode === 'AUTO' ? 'Thiết bị tự động chạy theo ngưỡng cảm biến & Lịch trình.' : 'Bạn có toàn quyền bật/tắt thiết bị bên dưới.'}
        </span>
      </div>

      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        {/* Manual Control */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h4>Điều khiển Thủ công</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {controlDevices.length === 0 && <li>Không có thiết bị điều khiển ở ao này.</li>}
            {controlDevices.map(dev => (
              <li key={dev.ma_thiet_bi} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <span>{dev.ma_thiet_bi} ({dev.loai_thiet_bi})</span>
                {hasPermission('device:status:update') ? (
                  <button 
                    onClick={() => handleToggleDevice(dev.ma_thiet_bi, dev.trang_thai)}
                    style={{ backgroundColor: dev.trang_thai === 'HOAT_DONG' ? '#4CAF50' : '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {dev.trang_thai === 'HOAT_DONG' ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </button>
                ) : (
                  <span style={{ color: '#999' }}>{dev.trang_thai}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Auto Config */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h4>Cấu hình Ngưỡng (AUTO)</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {pondConfig.configs.map(conf => (
              <li key={conf.ma_rule} style={{ marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '6px' }}>
                <strong>Cảm biến {conf.LoaiCamBien}</strong>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                  <label>Min:</label>
                  <input type="number" step="0.1" defaultValue={conf.min_value} id={`min_${conf.ma_rule}`} style={{ width: '70px' }}/>
                  <label>Max:</label>
                  <input type="number" step="0.1" defaultValue={conf.max_value} id={`max_${conf.ma_rule}`} style={{ width: '70px' }}/>
                  {hasPermission('pond:update:config') && (
                    <button onClick={() => {
                        const min = document.getElementById(`min_${conf.ma_rule}`).value;
                        const max = document.getElementById(`max_${conf.ma_rule}`).value;
                        handleSaveRule(conf.LoaiCamBien, min, max);
                      }} style={{ padding: '6px 12px', cursor: 'pointer' }}>Lưu
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <hr style={{ margin: '30px 0', borderColor: '#eee' }} />

      {/* --- PHẦN 3: LỊCH TRÌNH VÀ CÔNG THỨC CHO ĂN --- */}
      <h3>Cài đặt Lịch trình & Công thức</h3>
      <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
        <h4>Cảnh báo chưa xử lý ({alerts.length})</h4>
        {alerts.length === 0 ? (
          <div style={{ color: '#777' }}>Không có cảnh báo chưa xử lý cho ao này.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {alerts.map((item) => (
              <li key={item.ma_log} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.mo_ta}</div>
                  <div style={{ fontSize: '0.85em', color: '#777' }}>{new Date(item.thoi_gian_khoi_tao).toLocaleString('vi-VN')}</div>
                </div>
                {hasPermission('alerts:ack') && (
                  <button onClick={() => handleAckAlert(item.ma_log)} style={{ border: 'none', background: '#1677ff', color: '#fff', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer' }}>
                    Đánh dấu đã xử lý
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        
        {/* Cột trái: Quản lý Công thức (Chi tiết & Xóa) */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h4>Danh sách Công thức & Chi tiết</h4>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th>Mã</th>
                  <th>Tỉ lệ</th>
                  <th>Ghi chú</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {formulas.map(f => (
                  <tr key={f.ma_cong_thuc} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 0' }}><strong>{f.ma_cong_thuc}</strong></td>
                    <td>{f.ti_le_cho_an || 'N/A'}</td>
                    <td title={f.thong_tin_bo_sung} style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.thong_tin_bo_sung || '-'}
                    </td>
                    <td>
                      {hasPermission('device:status:update') && (
                        <button 
                          onClick={() => handleDeleteFormula(f.ma_cong_thuc)}
                          style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '12px' }}
                        >
                          [Xóa]
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form thêm công thức nhanh */}
          <hr style={{ margin: '15px 0', border: '0.5px solid #eee' }} />
          <form onSubmit={handleAddFormula} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              placeholder="Mã CT mới" 
              value={formulaForm.ma_cong_thuc} 
              onChange={e => setFormulaForm({...formulaForm, ma_cong_thuc: e.target.value})} 
              required 
            />
            <div style={{ display: 'flex', gap: '5px' }}>
              <input 
                type="number" step="0.1" placeholder="Tỉ lệ" 
                value={formulaForm.ti_le_cho_an} 
                onChange={e => setFormulaForm({...formulaForm, ti_le_cho_an: e.target.value})} 
                style={{ flex: 1 }}
              />
              <input 
                placeholder="Thông tin bổ sung" 
                value={formulaForm.thong_tin_bo_sung} 
                onChange={e => setFormulaForm({...formulaForm, thong_tin_bo_sung: e.target.value})} 
                style={{ flex: 2 }}
              />
            </div>
            <button type="submit" style={{ background: '#1890ff', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}>
              + Thêm Công thức
            </button>
          </form>
        </div>

        {/* Cột phải: Thêm Lịch trình (Giữ nguyên hoặc tinh chỉnh) */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h4>Tạo Lịch cho Ao (Sử dụng Công thức trên)</h4>
          <form onSubmit={handleAddSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <select value={scheduleForm.ma_tb_dieu_khien} onChange={e => setScheduleForm({ ...scheduleForm, ma_tb_dieu_khien: e.target.value })} required style={{ padding: '8px' }}>
              <option value="">Chọn thiết bị điều khiển</option>
              {controllableDevices.map(d => (
                <option key={d.ma_thiet_bi} value={d.ma_thiet_bi}>
                  {d.ma_thiet_bi} ({d.loai_thiet_bi})
                </option>
              ))}
            </select>
            <select value={scheduleForm.ma_cong_thuc} onChange={e => setScheduleForm({ ...scheduleForm, ma_cong_thuc: e.target.value })} style={{ padding: '8px' }}>
              <option value="">Không dùng công thức</option>
              {formulas.map(f => (
                <option key={f.ma_cong_thuc} value={f.ma_cong_thuc}>{f.ma_cong_thuc}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="time" value={scheduleForm.start_time} onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} required style={{ flex: 1, padding: '8px' }}/>
              <input type="time" value={scheduleForm.end_time} onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} required style={{ flex: 1, padding: '8px' }}/>
            </div>
            <button type="submit" style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Đặt Lịch Trình
            </button>
            <button
              type="button"
              onClick={handleSuggestSchedule}
              disabled={suggestLoading}
              style={{ padding: '10px', background: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {suggestLoading ? 'Đang gợi ý...' : 'Gợi ý lịch tự động'}
            </button>
          </form>
          {suggestedSchedules.length > 0 && (
            <div style={{ marginTop: '12px', background: '#faf5ff', border: '1px solid #ead7ff', borderRadius: '8px', padding: '10px' }}>
              <h5 style={{ margin: '0 0 8px 0' }}>Lịch gợi ý</h5>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {suggestedSchedules.map((item) => (
                  <li key={item.id} style={{ marginBottom: '8px' }}>
                    <strong>{item.start_time} - {item.end_time}</strong>: {item.reason}{' '}
                    <button onClick={() => handleApplySuggested(item)} style={{ marginLeft: '8px' }}>
                      Áp dụng
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ marginTop: '15px' }}>
            <h5>Lịch đang chạy:</h5>
              <ul className="item-list">
              {schedules?.length > 0 ? (
                schedules.map(s => (
                  <li key={s?.ma_lich_trinh || Math.random()}>
                    {s?.ThietBiTaiBien_ID || s?.ma_tb_dieu_khien}:
                    {' '}
                    {s?.start_time} - {s?.end_time}
                    {' '}
                    | CT: {s?.ma_cong_thuc || 'N/A'}
                    <button onClick={() => handleDeleteSchedule(s.ma_lich_trinh)}>Xóa</button>
                  </li>
                ))
              ) : (
                <li>Chưa có lịch trình nào.</li>
              )}
            </ul>
          </div>
          
        </div>
      </div>

      {/* --- PHẦN 4: LỊCH SỬ CHO ĂN --- */}
      <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Lịch sử nhả thức ăn (Theo trạm)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Thời gian</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mã thiết bị</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Công thức</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mức độ thèm ăn</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Bằng chứng</th>
            </tr>
          </thead>
          <tbody>
            {feedingHistory.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>Chưa có dữ liệu</td></tr>
            ) : (
              feedingHistory.map((hist, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{new Date(hist.thoi_gian_cho_an).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.ma_tb_dieu_khien}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.ma_cong_thuc || 'N/A'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.muc_do_them_an || 'N/A'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.bang_chung_hinh_anh ? 'Có hình' : 'Không có'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default PondDetailPage;