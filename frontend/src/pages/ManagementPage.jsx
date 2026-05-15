import React, { useEffect, useMemo, useState } from 'react';
import {
  addDevice,
  addStation,
  deleteDevice,
  deleteStation,
  getDeviceHistory,
  getDeviceOverview,
  getGatewayInit,
  getPonds,
  getStations
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const initialStationForm = { ma_tram: '', ma_ao_nuoi: '', trang_thai_cloud: 'CONNECTED' };
const SENSOR_TYPES = ['TEMP', 'LIGHT', 'DO', 'PH', 'SALINITY'];
const CONTROLLER_TYPES = ['FAN', 'PUMP', 'FEEDER'];
const initialDeviceForm = { ma_tram: '', nhom_thiet_bi: 'sensor', loai_thiet_bi: SENSOR_TYPES[0], trang_thai: 'TAT' };

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('vi-VN') : '-');
const sanitizeCodePart = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

const ManagementPage = () => {
  const { hasPermission } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [stations, setStations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [gatewayMappings, setGatewayMappings] = useState([]);
  const [stationForm, setStationForm] = useState(initialStationForm);
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [pondRows, stationRows, deviceOverview] = await Promise.all([
        getPonds(),
        getStations(),
        getDeviceOverview()
      ]);
      const gatewayRows = await getGatewayInit().catch(() => []);
      setPonds(Array.isArray(pondRows) ? pondRows : []);
      setStations(Array.isArray(stationRows) ? stationRows : []);
      setDevices(Array.isArray(deviceOverview?.devices) ? deviceOverview.devices : []);
      setGatewayMappings(Array.isArray(gatewayRows) ? gatewayRows : []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu quản lý thiết bị');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedDeviceId) {
        setSelectedHistory(null);
        return;
      }
      try {
        const response = await getDeviceHistory(selectedDeviceId);
        setSelectedHistory(response);
      } catch (err) {
        setError(err.message || 'Không thể tải lịch sử thiết bị');
      }
    };

    fetchHistory();
  }, [selectedDeviceId]);

  const stationOptions = useMemo(
    () => stations.map((station) => ({
      ...station,
      label: `${station.ma_tram} - ${station.ma_ao_nuoi}`
    })),
    [stations]
  );

  const availableDeviceTypes = deviceForm.nhom_thiet_bi === 'sensor' ? SENSOR_TYPES : CONTROLLER_TYPES;

  const buildFallbackDeviceId = () => {
    const station = stations.find((item) => item.ma_tram === deviceForm.ma_tram);
    const pond = ponds.find((item) => item.ma_ao_nuoi === station?.ma_ao_nuoi);
    const typeCode = sanitizeCodePart(deviceForm.loai_thiet_bi, 'DEVICE');
    const zoneCode = sanitizeCodePart(pond?.ma_khu_vuc, 'KV');
    const pondCode = sanitizeCodePart(station?.ma_ao_nuoi, 'AO');
    const prefix = `${zoneCode}_${pondCode}_${typeCode}_`;
    const nextIndex = devices
      .filter((device) => String(device.ma_thiet_bi || '').startsWith(prefix))
      .reduce((max, device) => {
        const match = String(device.ma_thiet_bi || '').match(/_(\d+)$/);
        return Math.max(max, match ? Number(match[1]) : 0);
      }, 0) + 1;
    return `${prefix}${String(nextIndex).padStart(2, '0')}`;
  };

  const runAction = async (task) => {
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.message || 'Thao tác thất bại');
    }
  };

  const handleAddStation = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await addStation(stationForm);
      setStationForm(initialStationForm);
      await loadAll();
    });
  };

  const handleAddDevice = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await addDevice({
        ...deviceForm,
        ma_thiet_bi: buildFallbackDeviceId()
      });
      setDeviceForm(initialDeviceForm);
      await loadAll();
    });
  };

  const handleDeleteStation = async (stationId) => {
    if (!window.confirm(`Xóa trạm ${stationId}?`)) return;
    await runAction(async () => {
      await deleteStation(stationId);
      await loadAll();
    });
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm(`Xóa thiết bị ${deviceId}?`)) return;
    await runAction(async () => {
      await deleteDevice(deviceId);
      if (selectedDeviceId === deviceId) setSelectedDeviceId('');
      await loadAll();
    });
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h1 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Quản lý trạm và thiết bị</h1>
        <p style={{ margin: '6px 0 0', color: '#475569' }}>
          Tạo trạm trước, sau đó thêm cảm biến hoặc thiết bị điều khiển để hệ thống có thiết bị khả dụng cho kết nối và giám sát.
        </p>
      </section>

      {error && (
        <div style={{ padding: 14, borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>Thêm trạm</h3>
          <form onSubmit={handleAddStation} style={{ display: 'grid', gap: 12 }}>
            <input
              value={stationForm.ma_tram}
              onChange={(event) => setStationForm((prev) => ({ ...prev, ma_tram: event.target.value }))}
              placeholder="Mã trạm"
              required
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
            <select
              value={stationForm.ma_ao_nuoi}
              onChange={(event) => setStationForm((prev) => ({ ...prev, ma_ao_nuoi: event.target.value }))}
              required
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="">Chọn ao nuôi</option>
              {ponds.map((pond) => (
                <option key={pond.ma_ao_nuoi} value={pond.ma_ao_nuoi}>{pond.ma_ao_nuoi}</option>
              ))}
            </select>
            <select
              value={stationForm.trang_thai_cloud}
              onChange={(event) => setStationForm((prev) => ({ ...prev, trang_thai_cloud: event.target.value }))}
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="CONNECTED">CONNECTED</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
            <button
              type="submit"
              disabled={!hasPermission('station:create')}
              style={{ border: 'none', borderRadius: 10, padding: '10px 14px', background: '#0f766e', color: '#fff', cursor: 'pointer' }}
            >
              Thêm trạm
            </button>
          </form>
        </div>

        <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>Thêm thiết bị</h3>
          <form onSubmit={handleAddDevice} style={{ display: 'grid', gap: 12 }}>
            <select
              value={deviceForm.ma_tram}
              onChange={(event) => setDeviceForm((prev) => ({ ...prev, ma_tram: event.target.value }))}
              required
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="">Chọn trạm để kết nối</option>
              {stationOptions.map((station) => (
                <option key={station.ma_tram} value={station.ma_tram}>{station.label}</option>
              ))}
            </select>
            <select
              value={deviceForm.nhom_thiet_bi}
              onChange={(event) => setDeviceForm((prev) => ({
                ...prev,
                nhom_thiet_bi: event.target.value,
                loai_thiet_bi: event.target.value === 'sensor' ? SENSOR_TYPES[0] : CONTROLLER_TYPES[0]
              }))}
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="sensor">Cảm biến</option>
              <option value="control">Thiết bị điều khiển</option>
            </select>
            <select
              value={deviceForm.loai_thiet_bi}
              onChange={(event) => setDeviceForm((prev) => ({ ...prev, loai_thiet_bi: event.target.value }))}
              required
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              {availableDeviceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={deviceForm.trang_thai}
              onChange={(event) => setDeviceForm((prev) => ({ ...prev, trang_thai: event.target.value }))}
              style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
            >
              <option value="TAT">TẮT</option>
              <option value="HOAT_DONG">HOẠT ĐỘNG</option>
              <option value="BAO_TRI">BẢO TRÌ</option>
            </select>
            <button
              type="submit"
              disabled={!hasPermission('device:create')}
              style={{ border: 'none', borderRadius: 10, padding: '10px 14px', background: '#1d4ed8', color: '#fff', cursor: 'pointer' }}
            >
              Thêm thiết bị
            </button>
          </form>
          <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: '0.92em' }}>
            Mã thiết bị sẽ tự sinh theo khu vực, ao, loại thiết bị và STT tăng dần từ 01.
          </p>
        </div>
      </section>

      <section style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Danh sách trạm có thể kết nối</h3>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>Thiết bị mới sẽ kết nối vào các trạm này.</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: 12 }}>Mã trạm</th>
                <th style={{ padding: 12 }}>Ao nuôi</th>
                <th style={{ padding: 12 }}>Cloud</th>
                <th style={{ padding: 12 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station.ma_tram} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 12 }}>{station.ma_tram}</td>
                  <td style={{ padding: 12 }}>{station.ma_ao_nuoi}</td>
                  <td style={{ padding: 12 }}>{station.trang_thai_cloud}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      type="button"
                      disabled={!hasPermission('station:delete')}
                      onClick={() => handleDeleteStation(station.ma_tram)}
                      style={{ border: 'none', borderRadius: 8, padding: '8px 12px', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
                    >
                      Xóa trạm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Kết nối dữ liệu theo trạm</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>
            Đây là mapping thật mà gateway dùng để gửi dữ liệu lên backend: gateway/trạm, feeder và danh sách sensor IDs.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: 12 }}>Gateway / Trạm</th>
                <th style={{ padding: 12 }}>Ao</th>
                <th style={{ padding: 12 }}>Feeder</th>
                <th style={{ padding: 12 }}>Sensor IDs</th>
              </tr>
            </thead>
            <tbody>
              {gatewayMappings.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: 12, textAlign: 'center' }}>Chưa có mapping gateway.</td></tr>
              ) : gatewayMappings.map((item) => (
                <tr key={item.gateway_id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>{item.gateway_id}</td>
                  <td style={{ padding: 12 }}>{item.ao_id}</td>
                  <td style={{ padding: 12 }}>{item.feeder_id || '-'}</td>
                  <td style={{ padding: 12 }}>
                    {item.sensor_ids && Object.keys(item.sensor_ids).length > 0
                      ? Object.entries(item.sensor_ids).map(([key, value]) => `${key}: ${value}`).join(' | ')
                      : 'Chưa có cảm biến'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>Thiết bị đã khai báo</h3>
          {loading ? (
            <div>Đang tải thiết bị...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                    <th style={{ padding: 12 }}>Thiết bị</th>
                    <th style={{ padding: 12 }}>Loại</th>
                    <th style={{ padding: 12 }}>Trạm / Ao</th>
                    <th style={{ padding: 12 }}>Giá trị</th>
                    <th style={{ padding: 12 }}>Cảnh báo</th>
                    <th style={{ padding: 12 }}>Bảo trì gần nhất</th>
                    <th style={{ padding: 12 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.ma_thiet_bi} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 12, fontWeight: 600 }}>{device.ma_thiet_bi}</td>
                      <td style={{ padding: 12 }}>{device.loai_cam_bien || device.loai_thiet_bi || device.loai_phan_loai}</td>
                      <td style={{ padding: 12 }}>{device.ma_tram} / {device.ma_ao_nuoi}</td>
                      <td style={{ padding: 12 }}>{device.latest_value == null ? '--' : Number(device.latest_value).toFixed(1)}</td>
                      <td style={{ padding: 12 }}>{device.unresolved_alerts || 0} mở / {device.total_alerts || 0} tổng</td>
                      <td style={{ padding: 12 }}>{formatDateTime(device.latest_maintenance_at)}</td>
                      <td style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDeviceId(device.ma_thiet_bi)}
                          style={{ border: 'none', borderRadius: 8, padding: '8px 12px', background: '#0f766e', color: '#fff', cursor: 'pointer' }}
                        >
                          Xem lịch sử
                        </button>
                        <button
                          type="button"
                          disabled={!hasPermission('device:delete')}
                          onClick={() => handleDeleteDevice(device.ma_thiet_bi)}
                          style={{ border: 'none', borderRadius: 8, padding: '8px 12px', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>Lịch sử thiết bị</h3>
          {!selectedHistory ? (
            <p style={{ color: '#64748b' }}>Chọn một thiết bị để xem toàn bộ cảnh báo đã từng có và lần bảo trì gần nhất.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <strong>{selectedHistory.device?.ma_thiet_bi}</strong>
                <div style={{ color: '#64748b', marginTop: 4 }}>
                  {selectedHistory.device?.ma_ao_nuoi} / {selectedHistory.device?.ma_khu_vuc}
                </div>
                <div style={{ color: '#64748b', marginTop: 4 }}>
                  Sensor liên quan: {selectedHistory.sensor_ids?.length ? selectedHistory.sensor_ids.join(', ') : 'Không có'}
                </div>
                <div style={{ color: '#64748b', marginTop: 4 }}>
                  Lần bảo trì gần nhất: {formatDateTime(selectedHistory.latest_maintenance_at)}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Cảnh báo đã từng xuất hiện</div>
                <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                  {selectedHistory.alert_history?.length ? selectedHistory.alert_history.map((item) => (
                    <div key={item.history_key} style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600 }}>{item.severity_label}</div>
                      <div style={{ color: '#0f172a', marginTop: 4 }}>{item.description}</div>
                      <div style={{ color: '#64748b', marginTop: 4 }}>{formatDateTime(item.thoi_gian_khoi_tao)}</div>
                      <div style={{ color: item.acknowledged ? '#166534' : '#991b1b', marginTop: 4 }}>
                        {item.acknowledged ? 'Đã xử lý / bảo trì' : 'Chưa xử lý'}
                      </div>
                    </div>
                  )) : (
                    <div style={{ padding: 12, color: '#64748b' }}>Thiết bị này chưa có cảnh báo lịch sử.</div>
                  )}
                </div>
              </div>

              {selectedHistory.feeding_history?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Lịch sử vận hành gần nhất</div>
                  <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    {selectedHistory.feeding_history.map((item) => (
                      <div key={item.ma_ghi_chep} style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}>
                        <div>{formatDateTime(item.thoi_gian_cho_an)}</div>
                        <div style={{ color: '#64748b', marginTop: 4 }}>Công thức: {item.ma_cong_thuc || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ManagementPage;
