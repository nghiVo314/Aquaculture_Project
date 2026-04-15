import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPonds } from '../services/api';
import { useAuth } from '../context/AuthContext'; // THÊM DÒNG NÀY

const ZonePondsPage = () => {
  const { zoneId } = useParams(); 
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth(); // LẤY QUYỀN

  const canCreatePond = user?.permissions?.includes('pond:create');
  const canUpdatePond = user?.permissions?.includes('pond:update');
  const canDeletePond = user?.permissions?.includes('pond:delete');

  const fetchPonds = () => {
    setLoading(true);
    getPonds().then(data => {
      const filtered = data.filter(p => p.ma_khu_vuc === zoneId);
      setPonds(filtered);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchPonds();
  }, [zoneId]);

  // --- CÁC HÀM XỬ LÝ API (THÊM, SỬA, XÓA AO) ---
  const getToken = () => localStorage.getItem('aq_token');

  const handleAddPond = async () => {
    const ma_ao_nuoi = prompt("Nhập mã ao mới (VD: AO_05):");
    if (!ma_ao_nuoi) return;
    const dien_tich = prompt("Nhập diện tích ao (m2):", "1000");
    if (!dien_tich) return;

    try {
      const res = await fetch('http://127.0.0.1:5000/api/ponds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ ma_ao_nuoi, ma_khu_vuc: zoneId, dien_tich: Number(dien_tich) })
      });
      if (res.ok) {
        alert("Thêm ao thành công!");
        fetchPonds();
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
  };

  const handleEditPond = async (id, oldArea) => {
    const dien_tich = prompt(`Nhập diện tích mới cho ${id} (m2):`, oldArea);
    if (!dien_tich) return;

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/ponds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ ma_khu_vuc: zoneId, dien_tich: Number(dien_tich) })
      });
      if (res.ok) {
        alert("Cập nhật thành công!");
        fetchPonds();
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
  };

  const handleDeletePond = async (id) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${id}? Toàn bộ lịch sử cảm biến cũng sẽ mất!`)) return;

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/ponds/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        alert("Xóa thành công!");
        fetchPonds();
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
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
          <button onClick={handleAddPond} style={{ padding: '10px 15px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            + Thêm Ao Mới
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {ponds.length > 0 ? (
          ponds.map(pond => (
            <div key={pond.ma_ao_nuoi} className="card" style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', position: 'relative' }}>
              
              {/* Nút Xóa Đặt ở góc phải trên cùng */}
              {canDeletePond && (
                <button onClick={() => handleDeletePond(pond.ma_ao_nuoi)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                  X
                </button>
              )}

              <h3>Mã Ao: {pond.ma_ao_nuoi}</h3>
              <p>Diện tích: {pond.dien_tich} m² 
                {canUpdatePond && <button onClick={() => handleEditPond(pond.ma_ao_nuoi, pond.dien_tich)} style={{ marginLeft: '10px', fontSize: '0.8em', cursor: 'pointer' }}>Sửa</button>}
              </p>
              
              <Link to={`/ao-nuoi/${pond.ma_ao_nuoi}`}>
                <button style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                  Xem Chi Tiết Dữ Liệu
                </button>
              </Link>
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