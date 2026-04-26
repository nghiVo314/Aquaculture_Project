import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getDashboardSummary, addZone, updateZone, deleteZone, getManagers 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  LayoutDashboard, Waves, Fish, Activity, AlertTriangle, 
  Search, Plus, Edit2, Trash2, X, ChevronUp, ChevronDown 
} from 'lucide-react';

// ==========================================
// 1. COMPONENT: KPI CARD
// ==========================================
const KpiCard = ({ title, value, icon: Icon, colorClass, bgColorClass, tooltip }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow relative group">
    <div className={`p-4 rounded-full ${bgColorClass} ${colorClass}`}>
      <Icon size={28} />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    {/* Tooltip */}
    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {tooltip}
    </div>
  </div>
);

// ==========================================
// 1B. COMPONENT: SEARCHABLE MANAGER SELECT
// ==========================================
const SearchableManagerSelect = ({ managers, value, onChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const selected = managers.find((m) => m.ID === value);
    setSearchTerm(selected ? selected.TenDangNhap : '');
  }, [value, managers]);

  const handleSelect = (managerId) => {
    const selected = managers.find((m) => m.ID === managerId);
    onChange(managerId);
    setSearchTerm(selected ? selected.TenDangNhap : '');
    setIsFocused(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isFocused]);

  const filteredManagers = managers.filter((m) => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return true;
    return (
      m.TenDangNhap.toLowerCase().includes(keyword) ||
      m.ID.toLowerCase().includes(keyword)
    );
  });

  const showDropdown = isFocused && filteredManagers.length > 0;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        placeholder="Tìm kiếm tên hoặc mã..."
        value={searchTerm}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          onChange('');
        }}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 z-[999] mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-y-auto min-h-[120px] max-h-[200px]">
          {filteredManagers.map((manager) => (
            <button
              key={manager.ID}
              type="button"
              onClick={() => handleSelect(manager.ID)}
              className={`w-full h-10 px-4 text-left hover:bg-blue-50 transition-colors ${
                value === manager.ID ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-700'
              }`}
            >
              {manager.TenDangNhap} ({manager.ID})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. COMPONENT: MODAL FORM (THÊM/SỬA)
// ==========================================
const ZoneModal = ({ isOpen, onClose, onSubmit, initialData, isLoading, managers }) => {
  const [formData, setFormData] = useState({ ma_khu_vuc: '', loai_thuy_san: '', ma_nguoi_dung_quan_ly: '' });

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ma_khu_vuc: initialData.KhuVuc_ID || '', 
        loai_thuy_san: initialData.LoaiHaiSan || '',
        ma_nguoi_dung_quan_ly: initialData.Manager_ID || ''
      });
    } else {
      setFormData({ ma_khu_vuc: '', loai_thuy_san: '', ma_nguoi_dung_quan_ly: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ma_nguoi_dung_quan_ly) {
      alert('Vui lòng chọn người quản lý');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-[90%] max-w-[520px] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">
            {initialData ? 'Cập nhật Khu vực' : 'Thêm Khu vực mới'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã Khu Vực *</label>
            <input 
              type="text" 
              required
              disabled={!!initialData} // Không cho sửa ID nếu đang Edit
              placeholder="VD: KV_A"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
              value={formData.ma_khu_vuc}
              onChange={(e) => setFormData({...formData, ma_khu_vuc: e.target.value})}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại Thủy Sản *</label>
            <input 
              type="text" 
              required
              placeholder="VD: Tôm thẻ chân trắng"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={formData.loai_thuy_san}
              onChange={(e) => setFormData({...formData, loai_thuy_san: e.target.value})}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Người quản lý *</label>
            <SearchableManagerSelect
              managers={managers}
              value={formData.ma_nguoi_dung_quan_ly}
              onChange={(managerId) => setFormData({ ...formData, ma_nguoi_dung_quan_ly: managerId })}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center disabled:opacity-70"
            >
              {isLoading ? 'Đang xử lý...' : 'Lưu lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. MAIN COMPONENT: DASHBOARD
// ==========================================
const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State quản lý dữ liệu
  const [data, setData] = useState({ zones: [] });
  const [managers, setManagers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State quản lý UI & Tương tác
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'KhuVuc_ID', direction: 'asc' });
  
  // State quản lý Modal & Action
  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: 'add', data: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: '', type: '' });

  // Permissions
  const canCreateZone = user?.permissions?.includes('zone:create');
  const canUpdateZone = user?.permissions?.includes('zone:update');
  const canDeleteZone = user?.permissions?.includes('zone:delete');

  // Load Data
  const fetchDashboard = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [dashboardRes, managersRes] = await Promise.all([getDashboardSummary(), getManagers()]);
      setData(dashboardRes);
      setManagers(managersRes);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Helper hiển thị Toast tạm thời
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage({ text: '', type: '' }), 3000);
  };

  // --- LOGIC XỬ LÝ ACTION ---
  const handleOpenModal = (mode, zoneData = null) => {
    setModalConfig({ isOpen: true, mode, data: zoneData });
  };

  const handleSubmitZone = async (formData) => {
    setActionLoading(true);
    try {
      if (modalConfig.mode === 'add') {
        const payload = { 
          ma_khu_vuc: formData.ma_khu_vuc, 
          loai_thuy_san: formData.loai_thuy_san, 
          ma_nguoi_dung_quan_ly: formData.ma_nguoi_dung_quan_ly
        };
        await addZone(payload);
        showToast('Thêm khu vực thành công!');
      } else {
        const payload = { 
          loai_thuy_san: formData.loai_thuy_san, 
          ma_nguoi_dung_quan_ly: formData.ma_nguoi_dung_quan_ly
        };
        await updateZone(formData.ma_khu_vuc, payload);
        showToast('Cập nhật khu vực thành công!');
      }
      setModalConfig({ isOpen: false, mode: 'add', data: null });
      fetchDashboard();
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteZone = async (e, id) => {
    e.stopPropagation(); // Ngăn chặn trigger click vào dòng (chuyển trang)
    if (!window.confirm(`⚠️ Bạn có chắc muốn xóa khu vực ${id} và toàn bộ ao bên trong? Hành động này không thể hoàn tác.`)) return;

    try {
      await deleteZone(id);
      showToast('Đã xóa khu vực!', 'success');
      fetchDashboard();
    } catch (err) {
      alert(`Lỗi khi xóa: ${err.message}`);
    }
  };

  // --- LOGIC TÌM KIẾM & SẮP XẾP ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredAndSortedZones = useMemo(() => {
    let result = [...(data?.zones || [])];
    
    // 1. Tìm kiếm
    if (searchQuery) {
      result = result.filter(z => 
        z.KhuVuc_ID.toLowerCase().includes(searchQuery.toLowerCase()) ||
        z.LoaiHaiSan.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // 2. Sắp xếp
    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, sortConfig]);

  // Tính toán KPI tổng hợp
  const totalPonds = data?.zones?.reduce((sum, zone) => sum + (zone.so_ao || 0), 0) || 0;
  const totalArea = data?.zones?.reduce((sum, zone) => sum + (zone.tong_dien_tich || 0), 0) || 0;
  // Giả lập trạng thái active/warning nếu API chưa trả về
  // const activePonds = totalPonds > 0 ? totalPonds - 1 : 0; 
  // const warningPonds = totalPonds > 0 ? 1 : 0;

  // --- RENDER GIAO DIỆN ---
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-gray-800">Lỗi tải dữ liệu</h3>
      <p className="text-gray-500 mb-4">{error}</p>
      <button onClick={fetchDashboard} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Thử lại</button>
    </div>
  );

  if (isLoading) return (
    <div className="p-6 space-y-6">
      {/* Skeleton Loading UX */}
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse"></div>)}
      </div>
      <div className="h-64 bg-gray-200 rounded-xl animate-pulse mt-6"></div>
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {/* Toast Notification (Simple) */}
      {toastMessage.text && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white transition-all ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <LayoutDashboard className="mr-2" /> Tổng quan Trang trại
          </h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống giám sát và quản lý nuôi trồng thủy sản</p>
        </div>
      </div>

      {/* SECTION 1: TOP KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard 
          title="Tổng Khu Vực" value={data.zones?.length || 0} icon={LayoutDashboard} 
          colorClass="text-blue-600" bgColorClass="bg-blue-100" tooltip="Số lượng khu vực đang quản lý"
        />
        <KpiCard 
          title="Tổng Số Ao" value={totalPonds} icon={Waves} 
          colorClass="text-cyan-600" bgColorClass="bg-cyan-100" tooltip="Tổng số ao trong toàn hệ thống"
        />
        <KpiCard 
          title="Tổng Diện Tích" value={`${totalArea.toLocaleString()} m²`} icon={Activity} 
          colorClass="text-emerald-600" bgColorClass="bg-emerald-100" tooltip="Tổng diện tích mặt nước"
        />
        {/* <KpiCard 
          title="Trạng thái Ao" 
          value={
            <span className="flex items-center text-lg">
              <span className="text-green-600 mr-2">{activePonds} Tốt</span> / 
              <span className="text-red-500 ml-2">{warningPonds} Cảnh báo</span>
            </span>
          } 
          icon={AlertTriangle} colorClass={warningPonds > 0 ? "text-orange-500" : "text-green-500"} bgColorClass={warningPonds > 0 ? "bg-orange-100" : "bg-green-100"} 
          tooltip="cảnh báo"
        /> */}
      </div>

      {/* SECTION 2: CHARTS (Hiển thị biểu đồ phân bổ diện tích và số ao theo khu vực) */}
      {data.zones?.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Thống kê theo Khu vực</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.zones} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="KhuVuc_ID" stroke="#6B7280" />
                <YAxis yAxisId="left" orientation="left" stroke="#0ea5e9" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <ChartTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
                <Bar yAxisId="left" name="Số Ao (ao)" dataKey="so_ao" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" name="Diện Tích (m²)" dataKey="tong_dien_tich" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SECTION 3: BẢNG DANH SÁCH KHU VỰC NÂNG CẤP */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Fish className="mr-2 text-blue-600" size={20} /> Danh sách Khu vực
          </h3>
          
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm mã, loại thủy sản..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => handleOpenModal('add')}
              disabled={!canCreateZone}
              title={!canCreateZone ? 'Bạn không có quyền thêm khu vực' : ''}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${canCreateZone ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              <Plus size={18} className="mr-1" /> Thêm mới
            </button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                {/* Headers with Sorting */}
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('KhuVuc_ID')}>
                  <div className="flex items-center">Mã Khu Vực {sortConfig.key === 'KhuVuc_ID' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('LoaiHaiSan')}>
                  <div className="flex items-center">Loại Thủy Sản {sortConfig.key === 'LoaiHaiSan' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</div>
                </th>
                <th className="p-4 font-semibold">Người Quản Lý</th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('so_ao')}>
                  <div className="flex items-center">Số Ao {sortConfig.key === 'so_ao' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tong_dien_tich')}>
                  <div className="flex items-center">Diện Tích (m²) {sortConfig.key === 'tong_dien_tich' && (sortConfig.direction === 'asc' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>)}</div>
                </th>
                {/* <th className="p-4 font-semibold text-center">Trạng thái</th> */}
                <th className="p-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedZones.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Fish size={48} className="text-gray-300 mb-3" />
                      <p>Không tìm thấy dữ liệu khu vực nào.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedZones.map(zone => (
                  <tr 
                    key={zone.KhuVuc_ID} 
                    onClick={() => navigate(`/khu-vuc/${zone.KhuVuc_ID}/ao`)}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 font-semibold text-blue-600 group-hover:text-blue-800">
                      {zone.KhuVuc_ID}
                    </td>
                    <td className="p-4 text-gray-700">{zone.LoaiHaiSan}</td>
                    <td className="p-4 text-gray-700">
                      {zone.manager || zone.nguoiQuanLy ? (
                        zone.manager || zone.nguoiQuanLy
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">— Chưa phân công</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-700">{zone.so_ao || 0}</td>
                    <td className="p-4 text-gray-700">{(zone.tong_dien_tich || 0).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', zone); }}
                          disabled={!canUpdateZone}
                          title={!canUpdateZone ? 'Không có quyền sửa' : 'Chỉnh sửa'}
                          className={`p-2 rounded-lg transition-all ${
                            canUpdateZone 
                              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Edit2 size={18} />
                        </button>

                        <button 
                          onClick={(e) => handleDeleteZone(e, zone.KhuVuc_ID)}
                          disabled={!canDeleteZone}
                          title={!canDeleteZone ? 'Không có quyền xóa' : 'Xóa'}
                          className={`p-2 rounded-lg transition-all ${
                            canDeleteZone 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
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

      {/* Modal Overlay */}
      <ZoneModal 
        isOpen={modalConfig.isOpen} 
        onClose={() => setModalConfig({ isOpen: false, mode: 'add', data: null })}
        onSubmit={handleSubmitZone}
        initialData={modalConfig.data}
        isLoading={actionLoading}
        managers={managers}
      />
    </div>
  );
};

export default DashboardPage;














// import React, { useEffect, useState } from 'react';
// import { getDashboardSummary } from '../services/api';
// import { Link } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext'; // THÊM DÒNG NÀY

// const DashboardPage = () => {
//   const [data, setData] = useState(null);
//   const [error, setError] = useState('');
//   const { user } = useAuth(); // LẤY THÔNG TIN USER VÀ QUYỀN
//   console.log("User permissions:", user?.permissions); // Debug: In ra quyền của user để kiểm tra

//   // Các cờ kiểm tra quyền
//   const canCreateZone = user?.permissions?.includes('zone:create');
//   const canUpdateZone = user?.permissions?.includes('zone:update');
//   const canDeleteZone = user?.permissions?.includes('zone:delete');

//   const fetchDashboard = () => {
//     getDashboardSummary()
//       .then(res => setData(res))
//       .catch(err => setError(err.message));
//   };

//   useEffect(() => {
//     fetchDashboard();
//   }, []);

//   // --- CÁC HÀM XỬ LÝ API (THÊM, SỬA, XÓA KHU VỰC) ---
//   const getToken = () => localStorage.getItem('aq_token'); // Giả định bạn lưu token ở localStorage

//   const handleAddZone = async () => {
//     const ma_khu_vuc = prompt("Nhập mã khu vực mới (VD: KV_D):");
//     if (!ma_khu_vuc) return;
//     const loai_thuy_san = prompt("Nhập loại thủy sản (VD: Tôm sú):");
    
//     try {
//       const res = await fetch('http://127.0.0.1:5000/api/zones', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
//         body: JSON.stringify({ ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly: user.id })
//       });
//       if (res.ok) {
//         alert("Thêm thành công!");
//         fetchDashboard(); // Tải lại dữ liệu
//       } else {
//         const err = await res.json();
//         alert("Lỗi: " + err.message);
//       }
//     } catch (error) { alert("Lỗi mạng: " + error); }
//   };

//   const handleEditZone = async (id, oldType) => {
//     const loai_thuy_san = prompt(`Nhập loại thủy sản mới cho khu vực ${id}:`, oldType);
//     if (!loai_thuy_san) return;

//     try {
//       const res = await fetch(`http://127.0.0.1:5000/api/zones/${id}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
//         body: JSON.stringify({ loai_thuy_san, ma_nguoi_dung_quan_ly: user.id })
//       });
//       if (res.ok) {
//         alert("Cập nhật thành công!");
//         fetchDashboard();
//       } else {
//         const err = await res.json();
//         alert("Lỗi: " + err.message);
//       }
//     } catch (error) { alert("Lỗi mạng: " + error); }
//   };

//   const handleDeleteZone = async (id) => {
//     if (!window.confirm(`Bạn có chắc muốn xóa khu vực ${id} và tất cả ao bên trong không?`)) return;

//     try {
//       const res = await fetch(`http://127.0.0.1:5000/api/zones/${id}`, {
//         method: 'DELETE',
//         headers: { 'Authorization': `Bearer ${getToken()}` }
//       });
//       if (res.ok) {
//         alert("Xóa thành công!");
//         fetchDashboard();
//       } else {
//         const err = await res.json();
//         alert("Lỗi: " + err.message);
//       }
//     } catch (error) { alert("Lỗi mạng: " + error); }
//   };

//   if (error) return <div style={{ color: 'red', padding: '20px' }}>Lỗi tải Dashboard: {error}</div>;
//   if (!data) return <div style={{ padding: '20px' }}>Đang tải dữ liệu...</div>;

//   return (
//     <div className="panel">
//       <h2>Tổng quan Trang trại</h2>
      
//       {/* 4 Thẻ chỉ số KPI giữ nguyên... */}
//       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
//         {/* ... (Giữ nguyên code các thẻ KPI của bạn) ... */}
//       </div>

//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
//         <h3>Danh sách Khu vực</h3>
//         {canCreateZone && (
//           <button onClick={handleAddZone} style={{ padding: '10px 15px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
//             + Thêm Khu Vực
//           </button>
//         )}
//       </div>

//       <div className="table-responsive">
//         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
//           <thead>
//             <tr style={{ borderBottom: '2px solid #ccc' }}>
//               <th style={{ padding: '10px' }}>Mã Khu Vực</th>
//               <th style={{ padding: '10px' }}>Loại Thủy Sản</th>
//               <th style={{ padding: '10px' }}>Số Ao</th>
//               <th style={{ padding: '10px' }}>Tổng Diện Tích (m2)</th>
//               <th style={{ padding: '10px', textAlign: 'center' }}>Thao tác</th>
//             </tr>
//           </thead>
//           <tbody>
//             {data.zones.map(zone => (
//               <tr key={zone.KhuVuc_ID} style={{ borderBottom: '1px solid #eee' }}>
//                 <td style={{ padding: '10px' }}>
//                   <Link to={`/khu-vuc/${zone.KhuVuc_ID}/ao`} style={{ color: '#1890ff', fontWeight: 'bold', textDecoration: 'none' }}>
//                     {zone.KhuVuc_ID}
//                   </Link>
//                 </td>
//                 <td style={{ padding: '10px' }}>{zone.LoaiHaiSan}</td>
//                 <td style={{ padding: '10px' }}>{zone.so_ao}</td>
//                 <td style={{ padding: '10px' }}>{zone.tong_dien_tich || 0}</td>
//                 <td style={{ padding: '10px', textAlign: 'center' }}>
//                   {canUpdateZone && (
//                     <button onClick={() => handleEditZone(zone.KhuVuc_ID, zone.LoaiHaiSan)} style={{ marginRight: '10px', padding: '5px 10px', cursor: 'pointer' }}>
//                       Sửa
//                     </button>
//                   )}
//                   {canDeleteZone && (
//                     <button onClick={() => handleDeleteZone(zone.KhuVuc_ID)} style={{ padding: '5px 10px', background: '#ff4d4f', color: 'white', border: 'none', cursor: 'pointer' }}>
//                       Xóa
//                     </button>
//                   )}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };

// export default DashboardPage;