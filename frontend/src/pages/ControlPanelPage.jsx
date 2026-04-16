import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPonds, getDevices, getPondConfig, updateDeviceStatus, updatePondConfig, getFeedingHistory, updatePondMode } from '../services/api';

const ControlPanelPage = () => {
  const { hasPermission } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');
  const [devices, setDevices] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [feedingHistory, setFeedingHistory] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [pondMode, setPondMode] = useState('AUTO');

  // 1. Tải danh sách ao, thiết bị và lịch sử cho ăn khi vào trang 
  useEffect(() => {
    getPonds().then(data => {
      setPonds(data);
      if (data.length > 0) setSelectedPond(data[0].ma_ao_nuoi);
       // set mode cho ao đầu tiên
      setPondMode(data[0].che_do || 'AUTO');
    });
    getDevices().then(data => setDevices(data));
    
    // Tách riêng hàm tải lịch sử để gọi lại được
    const loadHistory = () => {
      getFeedingHistory()
        .then(data => setFeedingHistory(data))
        .catch(err => console.error("Lỗi tải lịch sử cho ăn:", err));
    };

    loadHistory(); // Gọi lần đầu

    // Tự động làm mới lịch sử mỗi 5 giây để bắt kịp Gateway main.py
    const intervalId = setInterval(loadHistory, 5000); 
    
    return () => clearInterval(intervalId); // Cleanup khi rời khỏi trang
  }, []);

  // 2. Tải cấu hình khi đổi Ao
useEffect(() => {
  if (!selectedPond) return;
  // LOAD CONFIG
  setLoading(true);
  getPondConfig(selectedPond).then(data => {
    setConfigs(data.configs || []);
    setLoading(false);
  });
  // SYNC MODE THEO AO ĐANG CHỌN
  const currentPond = ponds.find(
    p => p.ma_ao_nuoi === selectedPond
  );
  if (currentPond) {
    setPondMode(currentPond.che_do || 'AUTO');
  }
}, [selectedPond, ponds]);

  const handleToggleDevice = async (deviceId, currentStatus) => {
    if (pondMode === 'AUTO') {
        alert("Vui lòng chuyển ao sang chế độ MANUAL trước khi điều khiển thủ công!");
        return;
    }
    const newStatus = currentStatus === 'HOAT_DONG' ? 'TAT' : 'HOAT_DONG';
    try {
      await updateDeviceStatus(deviceId, newStatus);
      setDevices(devices.map(d => d.ma_thiet_bi === deviceId ? { ...d, trang_thai: newStatus } : d));
      alert(`Đã gửi lệnh ${newStatus} xuống thiết bị ${deviceId}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveRule = async (LoaiCamBien, min_value, max_value) => {
    try {
      await updatePondConfig(selectedPond, { LoaiCamBien, min_value: Number(min_value), max_value: Number(max_value) });
      alert(`Đã cập nhật ngưỡng cho ${LoaiCamBien}`);
    } catch (error) {
      alert(error.message);
    }
  };

const handleToggleMode = async () => {
  const newMode =
    pondMode === 'AUTO'
      ? 'MANUAL'
      : 'AUTO';

  try {
    await updatePondMode(selectedPond, newMode);
    // update button ngay
    setPondMode(newMode);
    // update ponds array luôn
    setPonds(prev =>
      prev.map(p =>
        p.ma_ao_nuoi === selectedPond
          ? { ...p, che_do: newMode }
          : p
      )
    );
    alert(`Đã chuyển sang ${newMode}`);
  } catch (error) {
    alert("Lỗi chuyển chế độ: " + error.message);
  }
};

  const currentPondData = ponds.find(p => p.ma_ao_nuoi === selectedPond);
  const controlDevices = devices.filter(d => 
    d.loai_thiet_bi !== null && 
    currentPondData && d.ma_tram === currentPondData.ma_tram
  );

  return (
    <div className="panel">
      <h2>Bảng Điều khiển & Tự động hóa</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label><strong>Chọn Ao Nuôi: </strong></label>
        <select value={selectedPond} onChange={(e) => setSelectedPond(e.target.value)} style={{ padding: '8px', marginLeft: '10px' }}>
          {ponds.map(p => <option key={p.ma_ao_nuoi} value={p.ma_ao_nuoi}>{p.ma_ao_nuoi} - Trạm {p.ma_tram}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h3 style={{ margin: 0 }}>Chế độ điều khiển:</h3>
          <button 
              onClick={handleToggleMode}
              style={{
                  backgroundColor: pondMode === 'AUTO' ? '#2196F3' : '#FF9800',
                  color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
              }}
          >
              {pondMode === 'AUTO' ? 'TỰ ĐỘNG (AUTO)' : 'THỦ CÔNG (MANUAL)'}
          </button>
          <span style={{ color: '#555', fontSize: '14px' }}>
              {pondMode === 'AUTO' 
                  ? 'Hệ thống tự động điều khiển theo cảm biến.' 
                  : 'Bạn có toàn quyền bật/tắt thiết bị.'}
          </span>
      </div>

      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* PANEL 1: ĐIỀU KHIỂN THỦ CÔNG */}
        {/* (GIỮ NGUYÊN CODE PANEL 1 NHƯ CŨ) */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Điều khiển Thủ công (Manual)</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>Nhấn để bật/tắt thiết bị trực tiếp.</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {controlDevices.length === 0 && <li>Không có thiết bị điều khiển nào được gắn vào trạm này.</li>}
            {controlDevices.map(dev => (
              <li key={dev.ma_thiet_bi} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <span>{dev.ma_thiet_bi} ({dev.loai_thiet_bi})</span>
                {hasPermission('device:status:update') ? (
                  <button 
                    onClick={() => handleToggleDevice(dev.ma_thiet_bi, dev.trang_thai)}
                    style={{
                      backgroundColor: dev.trang_thai === 'HOAT_DONG' ? '#4CAF50' : '#f44336',
                      color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'
                    }}
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

        {/* PANEL 2: LUẬT TỰ ĐỘNG */}
        {/* (GIỮ NGUYÊN CODE PANEL 2 NHƯ CŨ) */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Cấu hình Ngưỡng Tự động (AUTO)</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>Thiết lập mức cảnh báo và kích hoạt tự động.</p>
          
          {loading ? <p>Đang tải cấu hình...</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {configs.map(conf => (
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
          )}
        </div>

        {/* PANEL 3: LỊCH SỬ CHO ĂN - ĐÃ SỬA LẠI TÊN CỘT */}
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}>
          <h3>Lịch sử nhả thức ăn (Feeder)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Thời gian</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mã thiết bị</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mã công thức</th>
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
                    {/* Sửa thoi_gian thành thoi_gian_cho_an */}
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                      {new Date(hist.thoi_gian_cho_an).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.ma_tb_dieu_khien}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.ma_cong_thuc || 'N/A'}</td>
                    
                    {/* Sửa ti_le_cho_an thành muc_do_them_an */}
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.muc_do_them_an || 'N/A'}</td>
                    
                    {/* Sửa bang_chung thành bang_chung_hinh_anh */}
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{hist.bang_chung_hinh_anh ? 'Có hình' : 'Không có'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default ControlPanelPage;