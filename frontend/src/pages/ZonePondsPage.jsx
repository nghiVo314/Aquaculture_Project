import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { addDevice, addPond, deletePond, getDevices, getDevicesByZone, getPonds, updatePond, getWorkers } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SENSOR_TYPES = ['TEMP', 'LIGHT', 'DO', 'PH', 'SALINITY'];
const CONTROLLER_TYPES = ['FAN', 'PUMP', 'FEEDER'];

const sanitizeCodePart = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

const getStatusLabel = (status) => {
  const normalized = String(status || 'TAT').toUpperCase();
  if (normalized === 'HOAT_DONG') return 'Hoạt động';
  if (normalized === 'BAO_TRI') return 'Bảo trì';
  return 'Tắt';
};

const ZonePondsPage = () => {
  const { zoneId } = useParams(); 
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ dien_tich: '', ma_nguoi_dung_phu_trach: '' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPondId, setEditPondId] = useState('');
  const [editForm, setEditForm] = useState({ dien_tich: '', ma_nguoi_dung_phu_trach: '' });
  const [workers, setWorkers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [selectedPondForDevice, setSelectedPondForDevice] = useState(null);
  const [deviceForm, setDeviceForm] = useState({ nhom_thiet_bi: 'sensor', loai_thiet_bi: SENSOR_TYPES[0], trang_thai: 'TAT' });
  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreatePond = user?.permissions?.includes('pond:create');
  const canUpdatePond = user?.permissions?.includes('pond:update');
  const canDeletePond = user?.permissions?.includes('pond:delete');
  const canCreateDevice = user?.permissions?.includes('device:create');

  const fetchPonds = () => {
    setLoading(true);
    Promise.all([
      getPonds(),
      getWorkers().catch(() => []),
      getDevicesByZone(zoneId).catch(() => getDevices().catch(() => []))
    ])
      .then(([pondData, workerData, deviceData]) => {
        const filtered = pondData
          .filter(p => p.ma_khu_vuc === zoneId)
          .sort((a, b) => String(a.ma_ao_nuoi || '').localeCompare(String(b.ma_ao_nuoi || ''), 'vi'));
        setPonds(filtered);
        setWorkers(Array.isArray(workerData) ? workerData : (workerData?.data || []));
        setDevices(Array.isArray(deviceData) ? deviceData : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPonds();
  }, [zoneId]);

  const handleAddPond = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ma_khu_vuc: zoneId,
        dien_tich: Number(addForm.dien_tich),
        ma_nguoi_dung_phu_trach: addForm.ma_nguoi_dung_phu_trach || null,
      };

      await addPond(payload);
      setIsAddOpen(false);
      setAddForm({ dien_tich: '', ma_nguoi_dung_phu_trach: '' });
      fetchPonds();
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  const openEditPond = (pond) => {
    setEditPondId(pond.ma_ao_nuoi);
    setEditForm({
      dien_tich: String(pond.dien_tich ?? ''),
      ma_nguoi_dung_phu_trach: pond.ma_nguoi_dung_phu_trach || ''
    });
    setIsEditOpen(true);
  };

  const handleEditPond = async (e) => {
    e.preventDefault();
    if (!editPondId) return;

    try {
      await updatePond(editPondId, {
        ma_khu_vuc: zoneId,
        dien_tich: Number(editForm.dien_tich),
        ma_nguoi_dung_phu_trach: editForm.ma_nguoi_dung_phu_trach || null
      });
      alert('Cập nhật thành công!');
      setIsEditOpen(false);
      setEditPondId('');
      setEditForm({ dien_tich: '' });
      fetchPonds();
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  const handleDeletePond = async (id) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${id}? Toàn bộ lịch sử cảm biến cũng sẽ mất!`)) return;

    try {
      await deletePond(id);
      alert('Xóa thành công!');
      fetchPonds();
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  const openAddDevice = (pond) => {
    setSelectedPondForDevice(pond);
    setDeviceForm({ nhom_thiet_bi: 'sensor', loai_thiet_bi: SENSOR_TYPES[0], trang_thai: 'TAT' });
    setIsAddDeviceOpen(true);
  };

  const buildFallbackDeviceId = (pond, deviceType) => {
    const typeCode = sanitizeCodePart(deviceType, 'DEVICE');
    const zoneCode = sanitizeCodePart(pond?.ma_khu_vuc || zoneId, 'KV');
    const pondCode = sanitizeCodePart(pond?.ma_ao_nuoi, 'AO');
    const prefix = `${zoneCode}_${pondCode}_${typeCode}_`;
    const nextIndex = devices
      .filter((device) => String(device.ma_thiet_bi || '').startsWith(prefix))
      .reduce((max, device) => {
        const match = String(device.ma_thiet_bi || '').match(/_(\d+)$/);
        return Math.max(max, match ? Number(match[1]) : 0);
      }, 0) + 1;
    return `${prefix}${String(nextIndex).padStart(2, '0')}`;
  };

  const handleAddDevice = async (event) => {
    event.preventDefault();
    if (!selectedPondForDevice?.ma_tram) {
      alert('Ao này chưa có trạm để gắn thiết bị.');
      return;
    }

    try {
      await addDevice({
        ...deviceForm,
        ma_thiet_bi: buildFallbackDeviceId(selectedPondForDevice, deviceForm.loai_thiet_bi),
        ma_tram: selectedPondForDevice.ma_tram
      });
      setIsAddDeviceOpen(false);
      setSelectedPondForDevice(null);
      fetchPonds();
    } catch (error) {
      alert('Lỗi thêm thiết bị: ' + error.message);
    }
  };

  const devicesByPond = ponds.reduce((acc, pond) => {
    acc[pond.ma_ao_nuoi] = devices.filter((device) =>
      device.ma_ao_nuoi === pond.ma_ao_nuoi || device.ma_tram === pond.ma_tram
    );
    return acc;
  }, {});

  const availableDeviceTypes = deviceForm.nhom_thiet_bi === 'sensor' ? SENSOR_TYPES : CONTROLLER_TYPES;

  if (loading) return <div style={{ padding: '20px' }}>Đang tải danh sách ao...</div>;

  return (
    <div className="panel">
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Quay lại</button>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Danh sách ao thuộc Khu vực: {zoneId}</h2>
        {canCreatePond && (
          <button onClick={() => setIsAddOpen(true)} style={{ padding: '10px 15px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            + Thêm Ao Mới
          </button>
        )}
      </div>

      {isAddOpen && canCreatePond && (
        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #cce5ff', borderRadius: '10px', background: '#f8fbff' }}>
          <h3 style={{ marginTop: 0 }}>Thêm ao mới</h3>
          <form onSubmit={handleAddPond} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>Mã ao mới</label>
              <input
                value={addForm.ma_ao_nuoi}
                onChange={(e) => setAddForm({ ...addForm, ma_ao_nuoi: e.target.value })}
                placeholder="Để trống nếu muốn tự sinh"
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>Diện tích (m2)</label>
              <input
                type="number"
                min="1"
                step="0.1"
                required
                value={addForm.dien_tich}
                onChange={(e) => setAddForm({ ...addForm, dien_tich: e.target.value })}
                placeholder="1000"
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>Worker phụ trách</label>
              <select
                value={addForm.ma_nguoi_dung_phu_trach}
                onChange={(e) => setAddForm({ ...addForm, ma_nguoi_dung_phu_trach: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              >
                <option value="">-- Chọn worker --</option>
                {workers.map((worker) => {
                  const workerId = worker.ma_nguoi_dung || worker.ID;
                  const workerName = worker.ten_dang_nhap || worker.TenDangNhap || worker.username;
                  return <option key={workerId} value={workerId}>{workerName}</option>;
                })}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '10px 14px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Lưu ao
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setAddForm({ dien_tich: '', ma_nguoi_dung_phu_trach: '' });
                }}
                style={{ padding: '10px 14px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {isEditOpen && canUpdatePond && (
        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #fde68a', borderRadius: '10px', background: '#fffdf2' }}>
          <h3 style={{ marginTop: 0 }}>Sửa ao {editPondId}</h3>
          <form onSubmit={handleEditPond} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>Diện tích (m2)</label>
              <input
                type="number"
                min="1"
                step="0.1"
                required
                value={editForm.dien_tich}
                onChange={(e) => setEditForm({ dien_tich: e.target.value })}
                placeholder="1000"
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>Worker phụ trách</label>
              <select
                value={editForm.ma_nguoi_dung_phu_trach}
                onChange={(e) => setEditForm({ ...editForm, ma_nguoi_dung_phu_trach: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
              >
                <option value="">-- Chưa gán worker --</option>
                {workers.map((worker) => {
                  const workerId = worker.ma_nguoi_dung || worker.ID;
                  const workerName = worker.ten_dang_nhap || worker.TenDangNhap || worker.username;
                  return <option key={workerId} value={workerId}>{workerName}</option>;
                })}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '10px 14px', background: '#faad14', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Lưu thay đổi
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditPondId('');
                  setEditForm({ dien_tich: '', ma_nguoi_dung_phu_trach: '' });
                }}
                style={{ padding: '10px 14px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {isAddDeviceOpen && canCreateDevice && selectedPondForDevice && (
        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #bfdbfe', borderRadius: '10px', background: '#f8fbff' }}>
          <h3 style={{ marginTop: 0 }}>Thêm thiết bị vào ao {selectedPondForDevice.ma_ao_nuoi}</h3>
          <p style={{ marginTop: 0, color: '#64748b' }}>Thiết bị sẽ được gắn vào trạm {selectedPondForDevice.ma_tram}.</p>
          <form onSubmit={handleAddDevice} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <select
              value={deviceForm.nhom_thiet_bi}
              onChange={(e) => setDeviceForm((prev) => ({
                ...prev,
                nhom_thiet_bi: e.target.value,
                loai_thiet_bi: e.target.value === 'sensor' ? SENSOR_TYPES[0] : CONTROLLER_TYPES[0]
              }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
            >
              <option value="sensor">Cảm biến</option>
              <option value="control">Thiết bị điều khiển</option>
            </select>
            <select
              value={deviceForm.loai_thiet_bi}
              onChange={(e) => setDeviceForm((prev) => ({ ...prev, loai_thiet_bi: e.target.value }))}
              required
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
            >
              {availableDeviceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={deviceForm.trang_thai}
              onChange={(e) => setDeviceForm((prev) => ({ ...prev, trang_thai: e.target.value }))}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
            >
              <option value="TAT">Tắt</option>
              <option value="HOAT_DONG">Hoạt động</option>
              <option value="BAO_TRI">Bảo trì</option>
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '10px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Thêm thiết bị
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddDeviceOpen(false);
                  setSelectedPondForDevice(null);
                }}
                style={{ padding: '10px 14px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy
              </button>
            </div>
          </form>
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: '0.92em' }}>
            Mã thiết bị sẽ tự sinh theo: khu vực + ao + loại + STT, ví dụ `KV_01_AO_01_TEMP_01`.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '24px', padding: '16px', border: '1px solid #dbeafe', borderRadius: '10px', background: '#f8fbff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0 }}>Bảng điều khiển thiết bị trong ao</h3>
          <span style={{ color: '#64748b', fontSize: '0.95em' }}>Hiển thị thiết bị và tình trạng theo từng ao trong khu vực</span>
        </div>
        <div style={{ display: 'grid', gap: '14px' }}>
          {ponds.length === 0 ? (
            <div>Chưa có ao trong khu vực này.</div>
          ) : ponds.map((pond) => (
            <div key={`devices-${pond.ma_ao_nuoi}`} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', background: '#fff', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px' }}>
                <div>
                  <strong>{pond.ma_ao_nuoi}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.88em', marginTop: '4px' }}>
                    {(devicesByPond[pond.ma_ao_nuoi] || []).length} thiết bị trong ao
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.92em' }}>Trạm: {pond.ma_tram || 'Chưa có trạm'}</div>
                </div>
                {canCreateDevice && (
                  <button
                    type="button"
                    onClick={() => openAddDevice(pond)}
                    style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    + Thêm thiết bị
                  </button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                      <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Thiết bị</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Loại</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(devicesByPond[pond.ma_ao_nuoi] || []).length === 0 ? (
                      <tr><td colSpan="3" style={{ padding: '10px', textAlign: 'center' }}>Chưa có thiết bị.</td></tr>
                    ) : (devicesByPond[pond.ma_ao_nuoi] || []).map((device) => (
                      <tr key={device.ma_thiet_bi}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{device.ma_thiet_bi}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{device.loai_cam_bien || device.loai_thiet_bi || device.loai_phan_loai}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{getStatusLabel(device.trang_thai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {ponds.length > 0 ? (
          ponds.map(pond => (
            <div
              key={pond.ma_ao_nuoi}
              className="card"
              onClick={() => navigate(`/ao-nuoi/${pond.ma_ao_nuoi}`)}
              style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', position: 'relative', cursor: 'pointer' }}
            >
              
              {/* Nút Xóa Đặt ở góc phải trên cùng */}
              {canDeletePond && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeletePond(pond.ma_ao_nuoi);
                  }}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  X
                </button>
              )}

              <h3>Mã Ao: {pond.ma_ao_nuoi}</h3>
              <p style={{ margin: '6px 0' }}>
                Worker phụ trách: <strong>{pond.nguoi_phu_trach || 'Chưa gán'}</strong>
              </p>
              <p>Diện tích: {pond.dien_tich} m² 
                {canUpdatePond && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditPond(pond);
                    }}
                    style={{ marginLeft: '10px', fontSize: '0.8em', cursor: 'pointer' }}
                  >
                    Sửa
                  </button>
                )}
              </p>
              <button style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Xem Chi Tiết Dữ Liệu
              </button>
            </div>
          ))
        ) : (
          <p>Chưa có ao nào trong khu vực này.</p>
        )}
      </div>
    </div>
  );
};

export default ZonePondsPage;
