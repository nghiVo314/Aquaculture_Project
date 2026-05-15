import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDashboardSummary,
  addZone,
  updateZone,
  deleteZone,
  getManagers,
  getAlerts,
  getWorkerWorkload,
  getDeviceOverview
} from '../services/api';
import { normalizeAlertCollection } from '../utils/warning';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import {
  LayoutDashboard,
  Fish,
  Activity,
  AlertTriangle,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Cpu,
  Power,
  Wrench
} from 'lucide-react';

const DEVICE_STATUS_COLORS = {
  active: '#16a34a',
  inactive: '#ef4444',
  maintenance: '#f59e0b'
};

const KpiCard = ({ title, value, icon: Icon, colorClass, bgColorClass, tooltip }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow relative group">
    <div className={`p-4 rounded-full ${bgColorClass} ${colorClass}`}>
      <Icon size={28} />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {tooltip}
    </div>
  </div>
);

const buildNextZoneId = (zones = []) => {
  const maxNumber = zones.reduce((max, zone) => {
    const match = String(zone.KhuVuc_ID || '').match(/(\d+)/);
    if (!match) return max;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `KV_${String(maxNumber + 1)}`;
};

const ZoneModal = ({ isOpen, onClose, onSubmit, initialData, isLoading, managers = [], suggestedZoneId = '' }) => {
  const [formData, setFormData] = useState({ ma_khu_vuc: '', loai_thuy_san: '', ma_nguoi_dung_quan_ly: '' });
  const [draggingManagerId, setDraggingManagerId] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ma_khu_vuc: initialData.KhuVuc_ID || '',
        loai_thuy_san: initialData.LoaiHaiSan || '',
        ma_nguoi_dung_quan_ly: initialData.managerId || ''
      });
    } else {
      setFormData({ ma_khu_vuc: suggestedZoneId || '', loai_thuy_san: '', ma_nguoi_dung_quan_ly: '' });
    }
    setDraggingManagerId('');
  }, [initialData, isOpen, suggestedZoneId]);

  if (!isOpen) return null;

  const selectedManager = managers.find((manager) => String(manager.ma_nguoi_dung || manager.ID || manager.id) === String(formData.ma_nguoi_dung_quan_ly));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const applyManager = (managerId) => {
    setFormData((prev) => ({ ...prev, ma_nguoi_dung_quan_ly: managerId }));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const managerId = event.dataTransfer.getData('text/plain') || draggingManagerId;
    if (managerId) applyManager(managerId);
    setDraggingManagerId('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">
            {initialData ? 'Cap nhat khu vuc' : 'Them khu vuc moi'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ma khu vuc *</label>
            <input
              type="text"
              required
              disabled={!!initialData}
              readOnly={!initialData}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 bg-gray-50"
              value={formData.ma_khu_vuc}
              onChange={(event) => setFormData({ ...formData, ma_khu_vuc: event.target.value })}
            />
            {!initialData && (
              <p className="text-xs text-gray-500 mt-1">Ma khu vuc se tu sinh, khong can nhap tay.</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Loai thuy san *</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={formData.loai_thuy_san}
              onChange={(event) => setFormData({ ...formData, loai_thuy_san: event.target.value })}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nguoi quan ly</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Danh sach quan ly</div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {managers.length === 0 && (
                    <div className="text-sm text-gray-500">Chua co nguoi quan ly.</div>
                  )}
                  {managers.map((manager) => {
                    const managerId = String(manager.ma_nguoi_dung || manager.ID || manager.id);
                    const managerName = manager.ten_dang_nhap || manager.TenDangNhap || manager.username || 'Khong ro';
                    const isActive = String(formData.ma_nguoi_dung_quan_ly) === managerId;
                    return (
                      <div
                        key={managerId}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', managerId);
                          setDraggingManagerId(managerId);
                        }}
                        onDragEnd={() => setDraggingManagerId('')}
                        onClick={() => applyManager(managerId)}
                        className={`rounded-lg border px-3 py-2 cursor-move transition-colors ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`}
                      >
                        <div className="font-medium text-gray-800">{managerName}</div>
                        <div className="text-xs text-gray-500">Keo vao o ben phai hoac bam de chon</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-3 min-h-40 flex flex-col justify-center"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Gan quan ly</div>
                {selectedManager ? (
                  <div className="rounded-lg bg-white border border-blue-200 p-3 shadow-sm">
                    <div className="font-semibold text-gray-800">{selectedManager.ten_dang_nhap || selectedManager.TenDangNhap || selectedManager.username}</div>
                    <div className="text-xs text-gray-500 mt-1">Da gan cho khu vuc nay</div>
                    <button
                      type="button"
                      onClick={() => applyManager('')}
                      className="mt-3 text-xs text-red-600 hover:text-red-700"
                    >
                      Bo chon
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-blue-700">Keo mot nguoi quan ly vao day.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Huy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center disabled:opacity-70"
            >
              {isLoading ? 'Dang xu ly...' : 'Luu lai'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState({ zones: [], deviceStatus: [], deviceTypes: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'KhuVuc_ID', direction: 'asc' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: 'add', data: null });
  const [managers, setManagers] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: '', type: '' });
  const [topAlerts, setTopAlerts] = useState([]);
  const [alertSort, setAlertSort] = useState('urgent');
  const [alertDays, setAlertDays] = useState('all');
  const [workerWorkload, setWorkerWorkload] = useState([]);
  const [workerDevices, setWorkerDevices] = useState([]);
  const suggestedZoneId = useMemo(() => buildNextZoneId(data.zones || []), [data.zones]);
  const isWorker = user?.roles?.includes('worker');

  const canCreateZone = user?.permissions?.includes('zone:create');
  const canUpdateZone = user?.permissions?.includes('zone:update');
  const canDeleteZone = user?.permissions?.includes('zone:delete');

  const visibleTopAlerts = useMemo(() => normalizeAlertCollection(topAlerts), [topAlerts]);
  const deviceStatusData = useMemo(() => (Array.isArray(data.deviceStatus) ? data.deviceStatus : []), [data.deviceStatus]);
  const deviceTypeSummary = useMemo(() => (Array.isArray(data.deviceTypes) ? data.deviceTypes : []), [data.deviceTypes]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await getDashboardSummary();
      setData(res);

      try {
        const mgrs = await getManagers();
        setManagers(Array.isArray(mgrs) ? mgrs : (mgrs?.data || []));
      } catch (innerError) {
        console.warn('Khong lay duoc danh sach managers', innerError.message);
      }

      try {
        const alerts = await getAlerts('', {
          sort: alertSort,
          days: alertDays === 'all' ? undefined : Number(alertDays)
        });
        setTopAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (innerError) {
        console.warn('Khong lay duoc canh bao', innerError.message);
      }

      try {
        const workload = await getWorkerWorkload();
        setWorkerWorkload(Array.isArray(workload) ? workload : []);
      } catch (innerError) {
        console.warn('Khong lay duoc thong ke workload', innerError.message);
      }

      if (isWorker) {
        try {
          const overview = await getDeviceOverview();
          setWorkerDevices(Array.isArray(overview?.devices) ? overview.devices : []);
        } catch (innerError) {
          console.warn('Khong lay duoc danh sach thiet bi cho worker', innerError.message);
          setWorkerDevices([]);
        }
      } else {
        setWorkerDevices([]);
      }
    } catch (err) {
      setError(err.message || 'Co loi xay ra khi tai du lieu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [alertSort, alertDays, isWorker]);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage({ text: '', type: '' }), 3000);
  };

  const handleOpenModal = (mode, zoneData = null) => {
    setModalConfig({ isOpen: true, mode, data: zoneData });
  };

  const handleSubmitZone = async (formData) => {
    setActionLoading(true);
    try {
      if (modalConfig.mode === 'add') {
        await addZone({
          ma_khu_vuc: formData.ma_khu_vuc || undefined,
          loai_thuy_san: formData.loai_thuy_san,
          ma_nguoi_dung_quan_ly: formData.ma_nguoi_dung_quan_ly || null
        });
        showToast('Them khu vuc thanh cong');
      } else {
        await updateZone(formData.ma_khu_vuc, {
          loai_thuy_san: formData.loai_thuy_san,
          ma_nguoi_dung_quan_ly: formData.ma_nguoi_dung_quan_ly || null
        });
        showToast('Cap nhat khu vuc thanh cong');
      }

      setModalConfig({ isOpen: false, mode: 'add', data: null });
      fetchDashboard();
    } catch (err) {
      alert(`Loi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteZone = async (event, id) => {
    event.stopPropagation();
    if (!window.confirm(`Ban co chac muon xoa khu vuc ${id} va toan bo ao ben trong?`)) return;

    try {
      await deleteZone(id);
      showToast('Da xoa khu vuc');
      fetchDashboard();
    } catch (err) {
      alert(`Loi khi xoa: ${err.message}`);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredAndSortedZones = useMemo(() => {
    let result = [...(data?.zones || [])];

    if (searchQuery) {
      result = result.filter((zone) =>
        String(zone.KhuVuc_ID || '').toLowerCase().includes(searchQuery.toLowerCase())
        || String(zone.LoaiHaiSan || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    result.sort((left, right) => {
      if (left[sortConfig.key] < right[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (left[sortConfig.key] > right[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, sortConfig]);

  const workerDeviceIssues = useMemo(() => {
    return workerDevices
      .filter((device) =>
        String(device.trang_thai || '').toUpperCase() !== 'HOAT_DONG'
        || String(device.trang_thai_cloud || '').toUpperCase() !== 'CONNECTED'
        || Number(device.active_alerts || 0) > 0
      )
      .map((device) => {
        const issues = [];
        if (String(device.trang_thai || '').toUpperCase() === 'BAO_TRI') issues.push('Dang bao tri');
        if (String(device.trang_thai || '').toUpperCase() === 'TAT') issues.push('Dang tat');
        if (String(device.trang_thai_cloud || '').toUpperCase() !== 'CONNECTED') issues.push('Tram mat ket noi');
        if (Number(device.active_alerts || 0) > 0) issues.push(`${Number(device.active_alerts || 0)} canh bao dang mo`);
        return {
          ...device,
          issueText: issues.join(' | ') || 'Can kiem tra'
        };
      })
      .sort((left, right) => Number(right.active_alerts || 0) - Number(left.active_alerts || 0));
  }, [workerDevices]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-800">Loi tai du lieu</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Thu lai</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse mt-6" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {toastMessage.text && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white transition-all ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage.text}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <LayoutDashboard className="mr-2" /> Tong quan trang trai
          </h1>
          <p className="text-gray-500 text-sm mt-1">Dashboard hien tai uu tien theo doi tinh trang thiet bi trong he thong</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          title="Tong thiet bi"
          value={data.cards?.total_devices || 0}
          icon={Cpu}
          colorClass="text-blue-600"
          bgColorClass="bg-blue-100"
          tooltip="Tong so thiet bi trong he thong"
        />
        <KpiCard
          title="Hoat dong"
          value={data.cards?.active_devices || 0}
          icon={Power}
          colorClass="text-emerald-600"
          bgColorClass="bg-emerald-100"
          tooltip="So thiet bi dang hoat dong tot"
        />
        <KpiCard
          title="Khong hoat dong"
          value={data.cards?.inactive_devices || 0}
          icon={AlertTriangle}
          colorClass="text-red-600"
          bgColorClass="bg-red-100"
          tooltip="So thiet bi dang tat hoac ngung hoat dong"
        />
        <KpiCard
          title="Bao tri"
          value={data.cards?.maintenance_devices || 0}
          icon={Wrench}
          colorClass="text-amber-600"
          bgColorClass="bg-amber-100"
          tooltip="So thiet bi dang cho bao tri"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Ti le tinh trang thiet bi</h3>
            <p className="text-sm text-gray-500">Pie chart cho nhom tot, khong hoat dong va bao tri</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceStatusData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                >
                  {deviceStatusData.map((entry) => (
                    <Cell key={entry.key} fill={DEVICE_STATUS_COLORS[entry.key] || '#94a3b8'} />
                  ))}
                </Pie>
                <ChartTooltip formatter={(value, name) => [`${value} thiet bi`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {deviceStatusData.map((item) => (
              <div key={item.key} className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: DEVICE_STATUS_COLORS[item.key] || '#94a3b8' }}
                  />
                  <span className="text-sm text-slate-500">{item.label}</span>
                </div>
                <div className="text-xl font-bold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Tong hop theo loai thiet bi</h3>
            <p className="text-sm text-gray-500">Nua con lai de nhin nhanh loai nao dang on, loai nao dang loi</p>
          </div>
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Loai</th>
                  <th>Tong</th>
                  <th>Tot</th>
                  <th>Tat</th>
                  <th>Bao tri</th>
                </tr>
              </thead>
              <tbody>
                {deviceTypeSummary.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 16, textAlign: 'center' }}>Chua co du lieu thiet bi.</td>
                  </tr>
                ) : deviceTypeSummary.map((item) => (
                  <tr key={item.device_label}>
                    <td style={{ fontWeight: 600 }}>{item.device_label}</td>
                    <td>{item.total_devices}</td>
                    <td style={{ color: '#166534', fontWeight: 700 }}>{item.active_devices}</td>
                    <td style={{ color: '#b91c1c', fontWeight: 700 }}>{item.inactive_devices}</td>
                    <td style={{ color: '#b45309', fontWeight: 700 }}>{item.maintenance_devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isWorker && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex justify-between items-center gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Thiet bi can worker kiem tra</h3>
              <p className="text-sm text-gray-500">Chi hien thi thiet bi trong cac ao duoc giao cho ban</p>
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Ao</th>
                  <th>Thiet bi</th>
                  <th>Loai</th>
                  <th>Tinh trang</th>
                  <th>Van de</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workerDeviceIssues.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: 16, textAlign: 'center' }}>Khong co thiet bi nao can kiem tra.</td>
                  </tr>
                ) : workerDeviceIssues.map((device) => (
                  <tr key={device.ma_thiet_bi}>
                    <td>{device.ma_ao_nuoi}</td>
                    <td style={{ fontWeight: 600 }}>{device.ma_thiet_bi}</td>
                    <td>{device.loai_cam_bien || device.loai_thiet_bi || device.loai_phan_loai}</td>
                    <td>{device.trang_thai}</td>
                    <td>{device.issueText}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/ao-nuoi/${device.ma_ao_nuoi}`)}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
                      >
                        Vao ao
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Canh bao noi bat</h3>
            <p className="text-sm text-gray-500">Hien thi toan bo canh bao theo bo loc ngay va muc do</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select value={alertDays} onChange={(event) => setAlertDays(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="all">Tat ca ngay</option>
              <option value="7">7 ngay</option>
              <option value="30">30 ngay</option>
              <option value="90">90 ngay</option>
            </select>
            <select value={alertSort} onChange={(event) => setAlertSort(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="urgent">Can xu ly gap</option>
              <option value="newest">Moi nhat</option>
            </select>
            <button type="button" onClick={() => window.location.assign('/alerts')} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium">
              Xem toan bo
            </button>
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Thoi gian</th>
                <th>Thiet bi</th>
                <th>Mo ta</th>
                <th>Muc do</th>
              </tr>
            </thead>
            <tbody>
              {visibleTopAlerts.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: 16, textAlign: 'center' }}>Chua co canh bao.</td>
                </tr>
              ) : visibleTopAlerts.map((log) => (
                <tr key={log.alertKey}>
                  <td>{log.changedAt ? new Date(log.changedAt).toLocaleString('vi-VN') : '-'}</td>
                  <td>{log.displayDevice}</td>
                  <td>{log.displayDescription}</td>
                  <td>
                    <span style={{ padding: '4px 10px', borderRadius: 999, color: '#fff', background: log.severityColor }}>
                      {log.severityLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {workerWorkload.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Activity className="mr-2 text-purple-600" size={20} /> Phan cong cong nhan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workerWorkload.map((worker) => (
              <div key={worker.ma_nguoi_dung} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{worker.ten_dang_nhap}</h4>
                    <p className="text-xs text-gray-500">{worker.role_name || 'Cong nhan'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${worker.pond_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {worker.pond_count} ao
                  </span>
                </div>

                <div className="mb-3">
                  {worker.assigned_ponds && worker.assigned_ponds.length > 0 ? (
                    <div className="space-y-1">
                      {worker.assigned_ponds.map((pond) => (
                        <div key={pond.ma_ao_nuoi} className="text-sm p-2 bg-gray-50 rounded border-l-2 border-blue-500">
                          <p className="font-medium text-gray-700">{pond.ma_ao_nuoi}</p>
                          <p className="text-xs text-gray-500">{pond.loai_thuy_san} • {pond.dien_tich?.toLocaleString()}m2</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Chua duoc gan ao nao</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Canh bao chua xu ly:</span>
                    <span className={`font-semibold text-lg ${worker.unacknowledged_alerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {worker.unacknowledged_alerts}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Fish className="mr-2 text-blue-600" size={20} /> Danh sach khu vuc
          </h3>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tim ma, loai thuy san..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <button
              onClick={() => handleOpenModal('add')}
              disabled={!canCreateZone}
              title={!canCreateZone ? 'Ban khong co quyen them khu vuc' : ''}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${canCreateZone ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              <Plus size={18} className="mr-1" /> Them moi
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('KhuVuc_ID')}>
                  <div className="flex items-center">Ma khu vuc {sortConfig.key === 'KhuVuc_ID' && (sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}</div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('LoaiHaiSan')}>
                  <div className="flex items-center">Loai thuy san {sortConfig.key === 'LoaiHaiSan' && (sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}</div>
                </th>
                <th className="p-4 font-semibold">Nguoi quan ly</th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('so_ao')}>
                  <div className="flex items-center">So ao {sortConfig.key === 'so_ao' && (sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}</div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tong_dien_tich')}>
                  <div className="flex items-center">Dien tich (m2) {sortConfig.key === 'tong_dien_tich' && (sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}</div>
                </th>
                <th className="p-4 font-semibold text-right">Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedZones.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Fish size={48} className="text-gray-300 mb-3" />
                      <p>Khong tim thay du lieu khu vuc nao.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedZones.map((zone) => (
                  <tr
                    key={zone.KhuVuc_ID}
                    onClick={() => navigate(`/khu-vuc/${zone.KhuVuc_ID}/ao`)}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 font-semibold text-blue-600 group-hover:text-blue-800">{zone.KhuVuc_ID}</td>
                    <td className="p-4 text-gray-700">{zone.LoaiHaiSan}</td>
                    <td className="p-4 text-gray-700">{zone.manager || zone.managerId || '-'}</td>
                    <td className="p-4 text-gray-700">{zone.so_ao || 0}</td>
                    <td className="p-4 text-gray-700">{(zone.tong_dien_tich || 0).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={(event) => { event.stopPropagation(); handleOpenModal('edit', zone); }}
                          disabled={!canUpdateZone}
                          title={!canUpdateZone ? 'Khong co quyen sua' : 'Chinh sua'}
                          className={`p-2 rounded-lg transition-all ${canUpdateZone ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        >
                          <Edit2 size={18} />
                        </button>

                        <button
                          onClick={(event) => handleDeleteZone(event, zone.KhuVuc_ID)}
                          disabled={!canDeleteZone}
                          title={!canDeleteZone ? 'Khong co quyen xoa' : 'Xoa'}
                          className={`p-2 rounded-lg transition-all ${canDeleteZone ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ZoneModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, mode: 'add', data: null })}
        onSubmit={handleSubmitZone}
        initialData={modalConfig.data}
        isLoading={actionLoading}
        managers={managers}
        suggestedZoneId={suggestedZoneId}
      />
    </div>
  );
};

export default DashboardPage;
