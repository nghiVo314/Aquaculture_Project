import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getPonds,
  getDevices,
  getPondConfig,
  updateDeviceStatus,
  updatePondConfig,
  getFeedingHistory,
  updatePondMode
} from '../services/api';

const RULE_ACTION_OPTIONS = [
  { value: 'HOAT_DONG', label: 'Bật thiết bị' },
  { value: 'TAT', label: 'Tắt thiết bị' }
];

const ControlPanelPage = () => {
  const { hasPermission } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');
  const [devices, setDevices] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [availableActuators, setAvailableActuators] = useState([]);
  const [feedingHistory, setFeedingHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pondMode, setPondMode] = useState('AUTO');

  useEffect(() => {
    getPonds().then((data) => {
      setPonds(data);
      if (data.length > 0) {
        setSelectedPond(data[0].ma_ao_nuoi);
        setPondMode(data[0].che_do || 'AUTO');
      }
    });
    getDevices().then((data) => setDevices(data));

    const loadHistory = () => {
      getFeedingHistory()
        .then((data) => setFeedingHistory(data))
        .catch((err) => console.error('Lỗi tải lịch sử cho ăn:', err));
    };

    loadHistory();
    const intervalId = setInterval(loadHistory, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedPond) return;
    setLoading(true);
    getPondConfig(selectedPond).then((data) => {
      setConfigs(data.configs || []);
      setAvailableActuators(data.available_actuators || []);
      setLoading(false);
    });

    const currentPond = ponds.find((p) => p.ma_ao_nuoi === selectedPond);
    if (currentPond) {
      setPondMode(currentPond.che_do || 'AUTO');
    }
  }, [selectedPond, ponds]);

  const handleToggleDevice = async (deviceId, currentStatus) => {
    if (pondMode === 'AUTO') {
      alert('Vui lòng chuyển ao sang chế độ MANUAL trước khi điều khiển thủ công.');
      return;
    }

    const newStatus = currentStatus === 'HOAT_DONG' ? 'TAT' : 'HOAT_DONG';
    try {
      await updateDeviceStatus(deviceId, newStatus);
      setDevices((prev) => prev.map((d) => (
        d.ma_thiet_bi === deviceId ? { ...d, trang_thai: newStatus } : d
      )));
      alert(`Đã gửi lệnh ${newStatus} xuống thiết bị ${deviceId}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSetDeviceStatus = async (deviceId, nextStatus) => {
    if (pondMode === 'AUTO') {
      alert('Vui lòng chuyển ao sang chế độ MANUAL trước khi điều khiển thủ công.');
      return;
    }

    try {
      await updateDeviceStatus(deviceId, nextStatus);
      setDevices((prev) => prev.map((d) => (
        d.ma_thiet_bi === deviceId ? { ...d, trang_thai: nextStatus } : d
      )));
      alert(`Đã gửi lệnh ${nextStatus} xuống thiết bị ${deviceId}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveRule = async (payload) => {
    try {
      await updatePondConfig(selectedPond, {
        ...payload,
        min_value: Number(payload.min_value),
        max_value: Number(payload.max_value)
      });
      const refreshed = await getPondConfig(selectedPond);
      setConfigs(refreshed.configs || []);
      alert(`Đã cập nhật rule cho ${payload.LoaiCamBien || payload.ma_cam_bien}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleToggleMode = async () => {
    const newMode = pondMode === 'AUTO' ? 'MANUAL' : 'AUTO';

    try {
      await updatePondMode(selectedPond, newMode);
      setPondMode(newMode);
      setPonds((prev) => prev.map((p) => (
        p.ma_ao_nuoi === selectedPond ? { ...p, che_do: newMode } : p
      )));
      alert(`Đã chuyển sang ${newMode}`);
    } catch (error) {
      alert(`Lỗi chuyển chế độ: ${error.message}`);
    }
  };

  const currentPondData = ponds.find((p) => p.ma_ao_nuoi === selectedPond);
  const controlDevices = devices.filter((d) => (
    d.loai_thiet_bi !== null && currentPondData && d.ma_tram === currentPondData.ma_tram
  ));

  return (
    <div className="panel">
      <h2>Bảng điều khiển và tự động hóa</h2>

      <div style={{ marginBottom: '20px' }}>
        <label><strong>Chọn ao nuôi: </strong></label>
        <select
          value={selectedPond}
          onChange={(e) => setSelectedPond(e.target.value)}
          style={{ padding: '8px', marginLeft: '10px' }}
        >
          {ponds.map((p) => (
            <option key={p.ma_ao_nuoi} value={p.ma_ao_nuoi}>
              {p.ma_ao_nuoi} - Trạm {p.ma_tram}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          background: '#e3f2fd',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}
      >
        <h3 style={{ margin: 0 }}>Chế độ điều khiển:</h3>
        <button
          onClick={handleToggleMode}
          style={{
            backgroundColor: pondMode === 'AUTO' ? '#2196F3' : '#FF9800',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {pondMode === 'AUTO' ? 'TỰ ĐỘNG (AUTO)' : 'THỦ CÔNG (MANUAL)'}
        </button>
        <span style={{ color: '#555', fontSize: '14px' }}>
          {pondMode === 'AUTO'
            ? 'Hệ thống tự động điều khiển theo cảm biến.'
            : 'Bạn có toàn quyền bật, tắt hoặc bảo trì thiết bị.'}
        </span>
      </div>

      <div className="grid-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Điều khiển thủ công</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Nhấn để bật, tắt hoặc chuyển thiết bị sang trạng thái bảo trì.
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {controlDevices.length === 0 && <li>Không có thiết bị điều khiển nào gắn vào trạm này.</li>}
            {controlDevices.map((dev) => (
              <li
                key={dev.ma_thiet_bi}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}
              >
                <span>{dev.ma_thiet_bi} ({dev.loai_thiet_bi})</span>
                {hasPermission('device:status:update') ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleToggleDevice(dev.ma_thiet_bi, dev.trang_thai)}
                      style={{
                        backgroundColor: dev.trang_thai === 'HOAT_DONG' ? '#4CAF50' : '#f44336',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {dev.trang_thai === 'HOAT_DONG' ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDeviceStatus(dev.ma_thiet_bi, dev.trang_thai === 'BAO_TRI' ? 'TAT' : 'BAO_TRI')}
                      style={{
                        backgroundColor: dev.trang_thai === 'BAO_TRI' ? '#64748b' : '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {dev.trang_thai === 'BAO_TRI' ? 'ĐANG BẢO TRÌ' : 'BẢO TRÌ'}
                    </button>
                  </div>
                ) : (
                  <span style={{ color: '#999' }}>{dev.trang_thai}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Cấu hình ngưỡng tự động</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Thiết lập min, max và hành động bật hoặc tắt theo rule.
          </p>

          {loading ? <p>Đang tải cấu hình...</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {configs.map((conf) => (
                <li key={conf.ma_rule || conf.ma_cam_bien} style={{ marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '6px' }}>
                  <strong>Cảm biến {conf.LoaiCamBien}</strong>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>Min:</label>
                    <input type="number" step="0.1" defaultValue={conf.min_value ?? ''} id={`min_${conf.ma_cam_bien}`} style={{ width: '70px' }} />
                    <label>Max:</label>
                    <input type="number" step="0.1" defaultValue={conf.max_value ?? ''} id={`max_${conf.ma_cam_bien}`} style={{ width: '70px' }} />
                    <div style={{ flexBasis: '100%', height: 0 }} />
                    <label>Thiết bị:</label>
                    <select defaultValue={conf.ma_tb_dieu_khien || ''} id={`actuator_${conf.ma_cam_bien}`}>
                      <option value="">Chọn thiết bị điều khiển</option>
                      {availableActuators.map((actuator) => (
                        <option key={actuator.ma_thiet_bi} value={actuator.ma_thiet_bi}>
                          {actuator.ma_thiet_bi} ({actuator.loai_thiet_bi})
                        </option>
                      ))}
                    </select>
                    <label>{'<'} Min:</label>
                    <select defaultValue={conf.low_action || 'HOAT_DONG'} id={`low_action_${conf.ma_cam_bien}`}>
                      {RULE_ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <label>{'>'} Max:</label>
                    <select defaultValue={conf.high_action || 'HOAT_DONG'} id={`high_action_${conf.ma_cam_bien}`}>
                      {RULE_ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {hasPermission('pond:update:config') && (
                      <button
                        onClick={() => {
                          const min = document.getElementById(`min_${conf.ma_cam_bien}`).value;
                          const max = document.getElementById(`max_${conf.ma_cam_bien}`).value;
                          const actuatorId = document.getElementById(`actuator_${conf.ma_cam_bien}`).value;
                          const lowAction = document.getElementById(`low_action_${conf.ma_cam_bien}`).value;
                          const highAction = document.getElementById(`high_action_${conf.ma_cam_bien}`).value;
                          handleSaveRule({
                            ma_rule: conf.ma_rule,
                            ma_cam_bien: conf.ma_cam_bien,
                            LoaiCamBien: conf.LoaiCamBien,
                            ma_tb_dieu_khien: actuatorId,
                            min_value: min,
                            max_value: max,
                            low_action: lowAction,
                            high_action: highAction
                          });
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

        <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}>
          <h3>Lịch sử nhật thực ăn</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Thời gian</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mã thiết bị</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mã công thức</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mức độ thêm ăn</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Bằng chứng</th>
              </tr>
            </thead>
            <tbody>
              {feedingHistory.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>Chưa có dữ liệu</td></tr>
              ) : (
                feedingHistory.map((hist, index) => (
                  <tr key={index}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                      {new Date(hist.thoi_gian_cho_an).toLocaleString('vi-VN')}
                    </td>
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
    </div>
  );
};

export default ControlPanelPage;
