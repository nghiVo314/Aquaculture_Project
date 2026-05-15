import React, { useEffect, useState, useMemo } from 'react';
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
  suggestSchedules,
  getThresholdHistory,
  getWorkers,
  getPondWorkers,
  addPondWorker,
  removePondWorker,
  updatePondWorkerRole
} from '../services/api';
import { normalizeAlertCollection } from '../utils/warning';

const SENSOR_SEVERITY_ORDER = {
  critical: 3,
  warning: 2,
  caution: 1,
  normal: 0,
  unknown: -1
};

const SENSOR_INSIGHTS = {
  TEMP: {
    high: { device: 'FAN', action: 'Bật quạt để hạ nhiệt', note: 'Nhiệt độ đang cao hơn ngưỡng an toàn.' },
    low: { device: 'FAN', action: 'Bật quạt theo chu kỳ / kiểm tra nước vào', note: 'Nhiệt độ đang thấp hơn ngưỡng.' }
  },
  DO: {
    high: { device: 'PUMP', action: 'Đã ổn định', note: 'Oxy hòa tan đang tốt.' },
    low: { device: 'PUMP', action: 'Bật sục khí / tăng oxy', note: 'Oxy hòa tan đang thấp.' }
  },
  LIGHT: {
    high: { device: 'FAN', action: 'Giảm chiếu sáng / che bớt nắng', note: 'Ánh sáng đang quá cao.' },
    low: { device: 'FAN', action: 'Kiểm tra nguồn sáng', note: 'Ánh sáng đang thấp.' }
  },
  PH: {
    high: { device: 'PUMP', action: 'Thay nước / điều chỉnh pH', note: 'pH đang cao hơn ngưỡng.' },
    low: { device: 'PUMP', action: 'Bổ sung nước / điều chỉnh pH', note: 'pH đang thấp hơn ngưỡng.' }
  },
  SALINITY: {
    high: { device: 'PUMP', action: 'Thay nước / giảm độ mặn', note: 'Độ mặn đang cao.' },
    low: { device: 'PUMP', action: 'Bổ sung muối / kiểm tra nguồn nước', note: 'Độ mặn đang thấp.' }
  }
};

const formatNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '--';
};

const getSensorMeta = (sensor) => {
  const value = Number(sensor.latest_value);
  const min = Number(sensor.min_value);
  const max = Number(sensor.max_value);
  const typeKey = String(sensor.LoaiCamBien || '').toUpperCase();
  const insight = SENSOR_INSIGHTS[typeKey] || {};

  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      statusKey: 'unknown',
      label: 'Chưa có dữ liệu',
      badgeClass: 'bg-slate-500',
      cardClass: 'border-slate-200 bg-slate-50',
      valueClass: 'text-slate-700 bg-slate-100',
      note: 'Đang chờ dữ liệu cảm biến.',
      actionText: 'Chưa thể đề xuất hành động',
      deviceText: 'Chưa xác định',
      displayValue: '--',
      detailText: `Ngưỡng an toàn: ${sensor.min_value} - ${sensor.max_value}`
    };
  }

  const range = Math.max(Math.abs(max - min), 0.1);
  const lowerGap = value < min ? (min - value) / range : 0;
  const upperGap = value > max ? (value - max) / range : 0;
  const edgeGap = value >= min && value <= max ? Math.min(value - min, max - value) / range : 0;
  const outOfRange = value < min || value > max;

  let statusKey = 'normal';
  if (outOfRange && Math.max(lowerGap, upperGap) >= 0.35) statusKey = 'critical';
  else if (outOfRange && Math.max(lowerGap, upperGap) >= 0.15) statusKey = 'warning';
  else if (outOfRange) statusKey = 'caution';
  else if (edgeGap <= 0.1) statusKey = 'caution';

  const statusMap = {
    critical: {
      label: 'Nguy hiểm',
      badgeClass: 'bg-red-600',
      badgeColor: '#dc2626',
      cardClass: 'border-red-200 bg-red-50',
      valueClass: 'text-red-700 bg-red-100'
    },
    warning: {
      label: 'Cảnh báo',
      badgeClass: 'bg-orange-500',
      badgeColor: '#f97316',
      cardClass: 'border-orange-200 bg-orange-50',
      valueClass: 'text-orange-700 bg-orange-100'
    },
    caution: {
      label: 'Cần chú ý',
      badgeClass: 'bg-amber-400',
      badgeColor: '#eab308',
      cardClass: 'border-amber-200 bg-amber-50',
      valueClass: 'text-amber-700 bg-amber-100'
    },
    normal: {
      label: 'Ổn định',
      badgeClass: 'bg-emerald-500',
      badgeColor: '#16a34a',
      cardClass: 'border-emerald-200 bg-emerald-50',
      valueClass: 'text-emerald-700 bg-emerald-100'
    },
    unknown: {
      label: 'Chưa rõ',
      badgeClass: 'bg-slate-400',
      badgeColor: '#94a3b8',
      cardClass: 'border-slate-200 bg-slate-50',
      valueClass: 'text-slate-700 bg-slate-100'
    }
  };

  const direction = value > max ? 'high' : 'low';
  const recommendation = insight[direction] || { device: 'N/A', action: 'Theo dõi thêm', note: 'Chưa có khuyến nghị cụ thể.' };

  return {
    statusKey,
    label: statusMap[statusKey].label,
    badgeClass: statusMap[statusKey].badgeClass,
    badgeColor: statusMap[statusKey].badgeColor,
    cardClass: statusMap[statusKey].cardClass,
    valueClass: statusMap[statusKey].valueClass,
    note: recommendation.note,
    actionText: recommendation.action,
    deviceText: recommendation.device,
    displayValue: formatNumber(value),
    detailText: `Ngưỡng an toàn: ${sensor.min_value} - ${sensor.max_value}`,
    deviation: outOfRange
      ? `Chênh ${Math.abs(value < min ? min - value : value - max).toFixed(1)}`
      : `Còn cách biên ${Math.min(value - min, max - value).toFixed(1)}`
  };
};

const getHistoryStatusLabel = (row) => (Number(row.da_sua) === 1 ? 'Đã sửa' : 'Chưa sửa');

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
  const [alertsSort, setAlertsSort] = useState('urgent');
  const [suggestedSchedules, setSuggestedSchedules] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [thresholdHistory, setThresholdHistory] = useState([]);
  const [pondWorkers, setPondWorkers] = useState([]);
  const [workerOptions, setWorkerOptions] = useState([]);
  const [workerForm, setWorkerForm] = useState({ ma_nguoi_dung: '', vai_tro: 'PRIMARY' });
  const [workerBusy, setWorkerBusy] = useState(false);

  const visibleAlerts = useMemo(() => normalizeAlertCollection(alerts), [alerts]);
  const [sensorFilter, setSensorFilter] = useState('all');
  const [sensorSort, setSensorSort] = useState('severity');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySort, setHistorySort] = useState('newest');
  const canManageWorkers = hasPermission('pond:manage:workers');

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

        const [allWorkers, currentWorkers] = await Promise.all([
          getWorkers().catch(() => []),
          getPondWorkers(id).catch(() => [])
        ]);
        setWorkerOptions(Array.isArray(allWorkers) ? allWorkers : (allWorkers?.data || []));
        setPondWorkers(Array.isArray(currentWorkers) ? currentWorkers : (currentWorkers?.data || []));

        // Tải lịch trình & lịch sử cho các thiết bị của ao này
        await refreshDynamicData(currentPondDevices);
        await loadPondAlerts();
        await loadThresholdHistory();

        // Đặt interval cập nhật dữ liệu động (Cảm biến & Lịch sử) mỗi 5s
        intervalId = setInterval(() => {
          getPondConfig(id).then(setPondConfig).catch(console.error);
          refreshDynamicData(currentPondDevices);
          loadPondAlerts();
          loadThresholdHistory();
          getPondWorkers(id).then((rows) => setPondWorkers(Array.isArray(rows) ? rows : (rows?.data || []))).catch(() => {});
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
  }, [id, alertsSort]);

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
      const rows = await getPondAlerts(id, 'unacknowledged', { sort: alertsSort });
      setAlerts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Lỗi tải cảnh báo ao:', err);
    }
  };

  const loadThresholdHistory = async () => {
    try {
      const rows = await getThresholdHistory(id);
      setThresholdHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Lỗi tải lịch sử chỉnh ngưỡng:', err);
      setThresholdHistory([]);
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

  const refreshPondWorkers = async () => {
    const rows = await getPondWorkers(id);
    setPondWorkers(Array.isArray(rows) ? rows : (rows?.data || []));
  };

  const handleAddPondWorker = async (event) => {
    event.preventDefault();
    if (!workerForm.ma_nguoi_dung) return;
    setWorkerBusy(true);
    try {
      await addPondWorker(id, workerForm);
      await refreshPondWorkers();
      setWorkerForm({ ma_nguoi_dung: '', vai_tro: 'PRIMARY' });
    } catch (err) {
      alert('Không thể gán worker: ' + err.message);
    } finally {
      setWorkerBusy(false);
    }
  };

  const handleRemovePondWorker = async (workerId) => {
    if (!window.confirm('Xóa worker khỏi ao này?')) return;
    setWorkerBusy(true);
    try {
      await removePondWorker(id, workerId);
      await refreshPondWorkers();
    } catch (err) {
      alert('Không thể xóa worker: ' + err.message);
    } finally {
      setWorkerBusy(false);
    }
  };

  const handleChangeWorkerRole = async (workerId, vai_tro) => {
    setWorkerBusy(true);
    try {
      await updatePondWorkerRole(id, workerId, { vai_tro });
      await refreshPondWorkers();
    } catch (err) {
      alert('Không thể cập nhật vai trò worker: ' + err.message);
    } finally {
      setWorkerBusy(false);
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

  const sensorRows = useMemo(() => {
    const rows = (pondConfig?.configs || []).map((sensor) => ({
      ...sensor,
      ...getSensorMeta(sensor)
    }));

    const filtered = rows.filter((sensor) => sensorFilter === 'all' || sensor.statusKey === sensorFilter);

    return filtered.sort((a, b) => {
      if (sensorSort === 'value') {
        return Number(b.latest_value || 0) - Number(a.latest_value || 0);
      }

      if (sensorSort === 'name') {
        return String(a.LoaiCamBien || '').localeCompare(String(b.LoaiCamBien || ''), 'vi');
      }

      return SENSOR_SEVERITY_ORDER[b.statusKey] - SENSOR_SEVERITY_ORDER[a.statusKey];
    });
  }, [pondConfig, sensorFilter, sensorSort]);

  const visibleThresholdHistory = useMemo(() => {
    let rows = Array.isArray(thresholdHistory) ? [...thresholdHistory] : [];

    if (historyFilter === 'done') {
      rows = rows.filter((row) => Number(row.da_sua) === 1);
    }

    if (historyFilter === 'pending') {
      rows = rows.filter((row) => Number(row.da_sua) !== 1);
    }

    rows.sort((a, b) => {
      const timeA = new Date(a.thoi_gian || 0).getTime();
      const timeB = new Date(b.thoi_gian || 0).getTime();
      return historySort === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return rows;
  }, [thresholdHistory, historyFilter, historySort]);

  if (!pondConfig) return <div>Đang tải dữ liệu ao...</div>;

  const controlDevices = devices.filter(d => d.loai_thiet_bi !== null);
  const controllableDevices = devices.filter(d => d.loai_thiet_bi !== null);

  return (
    <div className="panel">
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', cursor: 'pointer' }}>← Quay lại</button>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0 }}>Quản lý Ao: {id} {pondData ? `(Trạm ${pondData.ma_tram})` : ''}</h2>
          <div style={{ fontSize: '0.9em', color: '#6b7280', marginTop: '4px' }}>
            Worker phụ trách: {pondData?.nguoi_phu_trach || 'Chưa gán'}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', border: '1px solid #dbeafe', borderRadius: '8px', marginBottom: '20px', background: '#f8fbff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Phân công Worker cho Ao</h3>
          <span style={{ color: '#6b7280', fontSize: '0.9em' }}>Hỗ trợ nhiều worker trên cùng ao</span>
        </div>

        {canManageWorkers ? (
          <form onSubmit={handleAddPondWorker} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <select
              value={workerForm.ma_nguoi_dung}
              onChange={(e) => setWorkerForm({ ...workerForm, ma_nguoi_dung: e.target.value })}
              style={{ padding: '8px 10px', minWidth: 260 }}
            >
              <option value="">-- Chọn worker --</option>
              {workerOptions.map((worker) => {
                const workerId = worker.ma_nguoi_dung || worker.ID;
                const workerName = worker.ten_dang_nhap || worker.TenDangNhap || worker.username;
                return <option key={workerId} value={workerId}>{workerName}</option>;
              })}
            </select>
            <select
              value={workerForm.vai_tro}
              onChange={(e) => setWorkerForm({ ...workerForm, vai_tro: e.target.value })}
              style={{ padding: '8px 10px' }}
            >
              <option value="PRIMARY">PRIMARY</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="ASSISTANT">ASSISTANT</option>
            </select>
            <button type="submit" disabled={workerBusy || !workerForm.ma_nguoi_dung} style={{ padding: '8px 14px', cursor: 'pointer' }}>
              {workerBusy ? 'Đang xử lý...' : 'Gán worker'}
            </button>
          </form>
        ) : (
          <div style={{ marginBottom: 12, color: '#6b7280' }}>Bạn chỉ xem được danh sách worker của ao này.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {pondWorkers.length === 0 ? (
            <div style={{ color: '#6b7280' }}>Chưa có worker nào được gán.</div>
          ) : pondWorkers.map((worker) => (
            <div key={`${worker.ma_nguoi_dung}-${worker.vai_tro}`} style={{ border: '1px solid #dbeafe', borderRadius: 8, padding: 12, background: '#fff' }}>
              <div style={{ fontWeight: 700 }}>{worker.ten_dang_nhap}</div>
              <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: 4 }}>Vai trò: {worker.vai_tro}</div>
              {canManageWorkers && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <select
                    value={worker.vai_tro}
                    onChange={(e) => handleChangeWorkerRole(worker.ma_nguoi_dung, e.target.value)}
                    disabled={workerBusy}
                    style={{ padding: '6px 8px' }}
                  >
                    <option value="PRIMARY">PRIMARY</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="ASSISTANT">ASSISTANT</option>
                  </select>
                  <button type="button" onClick={() => handleRemovePondWorker(worker.ma_nguoi_dung)} disabled={workerBusy} style={{ padding: '6px 10px', color: '#fff', background: '#dc2626', border: 'none', borderRadius: 6 }}>
                    Xóa
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      {/* --- PHẦN 1: GIÁM SÁT CẢM BIẾN --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <h3 style={{ margin: 0 }}>Giám sát cảm biến</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select value={sensorFilter} onChange={(e) => setSensorFilter(e.target.value)} style={{ padding: '8px 10px' }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="critical">Nguy hiểm</option>
            <option value="warning">Cảnh báo</option>
            <option value="caution">Cần chú ý</option>
            <option value="normal">Ổn định</option>
          </select>
          <select value={sensorSort} onChange={(e) => setSensorSort(e.target.value)} style={{ padding: '8px 10px' }}>
            <option value="severity">Sắp xếp theo mức độ</option>
            <option value="value">Sắp xếp theo giá trị</option>
            <option value="name">Sắp xếp theo tên</option>
          </select>
        </div>
      </div>

      <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {sensorRows.length > 0 ? sensorRows.map(sensor => (
          <div key={sensor.ma_cam_bien} className="sensor-container" style={{ border: `1px solid ${sensor.statusKey === 'critical' ? '#fca5a5' : sensor.statusKey === 'warning' ? '#fdba74' : sensor.statusKey === 'caution' ? '#fcd34d' : '#bbf7d0'}`, padding: '16px', borderRadius: '14px', background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
              <div>
                <strong style={{ fontSize: '1.05em' }}>{sensor.LoaiCamBien}</strong>
                <div style={{ fontSize: '0.82em', color: '#6b7280', marginTop: '4px' }}>Thiết bị: {sensor.ma_cam_bien}</div>
              </div>
              <span style={{ fontSize: '0.8em', padding: '6px 10px', borderRadius: '999px', color: '#fff', background: sensor.badgeColor }}
              >
                {sensor.label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#0f7ba8', padding: '6px 12px', background: '#e6f7ff', borderRadius: '10px' }}>
                {sensor.displayValue}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ color: '#374151', fontSize: '0.92em' }}>{sensor.detailText}</div>
                <div style={{ color: '#6b7280', fontSize: '0.85em' }}>{sensor.note}</div>
                <div style={{ color: '#0f5132', fontSize: '0.85em', fontWeight: 600 }}>Tự động kích hoạt: {sensor.deviceText} | {sensor.actionText}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85em', color: '#666' }}>{sensor.deviation}</span>
              <span style={{ fontSize: '0.8em', color: '#fff', padding: '4px 10px', borderRadius: '999px', background: sensor.badgeColor }}>
                {sensor.label}
              </span>
            </div>
            <SensorChart deviceId={sensor.ma_cam_bien} label={sensor.LoaiCamBien} />
          </div>
        )) : (
          <div style={{ color: '#6b7280' }}>Chưa có cảm biến nào.</div>
        )}
      </div>

      <div className="card" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Lịch sử chỉnh ngưỡng</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} style={{ padding: '8px 10px' }}>
              <option value="all">Tất cả</option>
              <option value="done">Đã sửa</option>
              <option value="pending">Chưa sửa</option>
            </select>
            <select value={historySort} onChange={(e) => setHistorySort(e.target.value)} style={{ padding: '8px 10px' }}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Thời gian</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Loại</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Thiết bị</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Vị trí thiết bị</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Mô tả</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Người sửa</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visibleThresholdHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '18px', textAlign: 'center', color: '#6b7280' }}>Chưa có lịch sử chỉnh ngưỡng.</td>
                </tr>
              ) : (
                visibleThresholdHistory.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{new Date(row.thoi_gian).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{row.loai_cam_bien}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{row.ma_tb_dieu_khien}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{row.vi_tri_thiet_bi}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', maxWidth: '320px' }}>{row.mo_ta}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{row.nguoi_sua}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', background: Number(row.da_sua) === 1 ? '#dcfce7' : '#fee2e2', color: Number(row.da_sua) === 1 ? '#166534' : '#991b1b', fontSize: '0.8em', fontWeight: 700 }}>
                        {getHistoryStatusLabel(row)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0 }}>Cảnh báo nổi bật ({visibleAlerts.length})</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={alertsSort} onChange={(e) => setAlertsSort(e.target.value)} style={{ padding: '8px 10px' }}>
              <option value="urgent">Cần xử lý gấp</option>
              <option value="newest">Mới nhất</option>
            </select>
            <button type="button" onClick={() => navigate('/alerts')} style={{ background: '#f97316', color: '#fff' }}>
              Xem toàn bộ
            </button>
          </div>
        </div>
        {alerts.length === 0 ? (
          <div style={{ color: '#777', marginTop: 12 }}>Không có cảnh báo cho ao này.</div>
        ) : (
          <div style={{ maxHeight: 340, overflow: 'auto', marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>STT</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Thiết bị</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Vị trí</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mô tả</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Người xử lý</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Tình trạng</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Mức độ</th>
                </tr>
              </thead>
              <tbody>
                {visibleAlerts.map((item, index) => {
                  return (
                    <tr key={item.alertKey}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{index + 1}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.displayDevice}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.displayLocation}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', maxWidth: 360 }}>{item.displayDescription}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.displayWorker}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{item.acknowledged ? 'Đã xử lý' : 'Chưa xử lý'}</span>
                        {!item.acknowledged && hasPermission('alerts:ack') && (
                          <button onClick={() => handleAckAlert(item.ma_log)} style={{ border: 'none', background: '#1677ff', color: '#fff', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer' }}>
                            Đánh dấu đã xử lý
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 999, color: '#fff', background: item.severityColor }}>
                          {item.severityLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
