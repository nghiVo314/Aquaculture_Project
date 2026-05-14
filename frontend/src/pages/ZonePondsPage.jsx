import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { addPond, deletePond, getPonds, updatePond, getWorkers } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreatePond = user?.permissions?.includes('pond:create');
  const canUpdatePond = user?.permissions?.includes('pond:update');
  const canDeletePond = user?.permissions?.includes('pond:delete');

  const fetchPonds = () => {
    setLoading(true);
    Promise.all([getPonds(), getWorkers().catch(() => [])])
      .then(([pondData, workerData]) => {
        const filtered = pondData.filter(p => p.ma_khu_vuc === zoneId);
        setPonds(filtered);
        setWorkers(Array.isArray(workerData) ? workerData : (workerData?.data || []));
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