import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPonds, getDevices, getPondConfig, updateDeviceStatus, updatePondConfig } from '../services/api';

const ControlPanelPage = () => {
  const { hasPermission } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');
  const [devices, setDevices] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Tải danh sách ao khi vào trang
  useEffect(() => {
    getPonds().then(data => {
      setPonds(data);
      if (data.length > 0) setSelectedPond(data[0].ma_ao_nuoi);
    });
    getDevices().then(data => setDevices(data));
  }, []);

  // 2. Tải cấu hình khi đổi Ao
  useEffect(() => {
    if (!selectedPond) return;
    setLoading(true);
    getPondConfig(selectedPond).then(data => {
      setConfigs(data.configs || []);
      setLoading(false);
    });
  }, [selectedPond]);

  // Điều khiển Bật/Tắt thủ công
  const handleToggleDevice = async (deviceId, currentStatus) => {
    const newStatus = currentStatus === 'HOAT_DONG' ? 'TAT' : 'HOAT_DONG';
    try {
      await updateDeviceStatus(deviceId, newStatus);
      // Cập nhật UI ngay lập tức
      setDevices(devices.map(d => d.ma_thiet_bi === deviceId ? { ...d, trang_thai: newStatus } : d));
      alert(`Đã gửi lệnh ${newStatus} xuống thiết bị ${deviceId}`);
    } catch (error) {
      alert(error.message);
    }
  };

  // Cập nhật luật tự động
  const handleSaveRule = async (LoaiCamBien, min_value, max_value) => {
    try {
      await updatePondConfig(selectedPond, { LoaiCamBien, min_value: Number(min_value), max_value: Number(max_value) });
      alert(`Đã cập nhật ngưỡng cho ${LoaiCamBien}`);
    } catch (error) {
      alert(error.message);
    }
  };

  // Lọc các thiết bị điều khiển (Bơm, Quạt...) thuộc về Ao đang chọn
  // (Giả định ma_tram của thiết bị khớp với ma_tram của Ao)
  const currentPondData = ponds.find(p => p.ma_ao_nuoi === selectedPond);
  const controlDevices = devices.filter(d => 
    d.loai_thiet_bi !== null && // Là thiết bị điều khiển
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

      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* PANEL 1: ĐIỀU KHIỂN THỦ CÔNG */}
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
                    <input 
                      type="number" step="0.1" 
                      defaultValue={conf.min_value} 
                      id={`min_${conf.ma_rule}`}
                      style={{ width: '70px' }}
                    />
                    <label>Max:</label>
                    <input 
                      type="number" step="0.1" 
                      defaultValue={conf.max_value} 
                      id={`max_${conf.ma_rule}`}
                      style={{ width: '70px' }}
                    />
                    {hasPermission('pond:update:config') && (
                      <button 
                        onClick={() => {
                          const min = document.getElementById(`min_${conf.ma_rule}`).value;
                          const max = document.getElementById(`max_${conf.ma_rule}`).value;
                          handleSaveRule(conf.LoaiCamBien, min, max);
                        }}
                        style={{ padding: '6px 12px', cursor: 'pointer' }}
                      >
                        Lưu
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default ControlPanelPage;