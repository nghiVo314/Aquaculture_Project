import React, { useEffect, useState } from 'react';
import { getDashboardSummary } from '../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // THÊM DÒNG NÀY

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth(); // LẤY THÔNG TIN USER VÀ QUYỀN
  console.log("User permissions:", user?.permissions); // Debug: In ra quyền của user để kiểm tra

  // Các cờ kiểm tra quyền
  const canCreateZone = user?.permissions?.includes('zone:create');
  const canUpdateZone = user?.permissions?.includes('zone:update');
  const canDeleteZone = user?.permissions?.includes('zone:delete');

  const fetchDashboard = () => {
    getDashboardSummary()
      .then(res => setData(res))
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // --- CÁC HÀM XỬ LÝ API (THÊM, SỬA, XÓA KHU VỰC) ---
  const getToken = () => localStorage.getItem('aq_token'); // Giả định bạn lưu token ở localStorage

  const handleAddZone = async () => {
    const ma_khu_vuc = prompt("Nhập mã khu vực mới (VD: KV_D):");
    if (!ma_khu_vuc) return;
    const loai_thuy_san = prompt("Nhập loại thủy sản (VD: Tôm sú):");
    
    try {
      const res = await fetch('http://127.0.0.1:5000/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ ma_khu_vuc, loai_thuy_san, ma_nguoi_dung_quan_ly: user.id })
      });
      if (res.ok) {
        alert("Thêm thành công!");
        fetchDashboard(); // Tải lại dữ liệu
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
  };

  const handleEditZone = async (id, oldType) => {
    const loai_thuy_san = prompt(`Nhập loại thủy sản mới cho khu vực ${id}:`, oldType);
    if (!loai_thuy_san) return;

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/zones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ loai_thuy_san, ma_nguoi_dung_quan_ly: user.id })
      });
      if (res.ok) {
        alert("Cập nhật thành công!");
        fetchDashboard();
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm(`Bạn có chắc muốn xóa khu vực ${id} và tất cả ao bên trong không?`)) return;

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/zones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        alert("Xóa thành công!");
        fetchDashboard();
      } else {
        const err = await res.json();
        alert("Lỗi: " + err.message);
      }
    } catch (error) { alert("Lỗi mạng: " + error); }
  };

  if (error) return <div style={{ color: 'red', padding: '20px' }}>Lỗi tải Dashboard: {error}</div>;
  if (!data) return <div style={{ padding: '20px' }}>Đang tải dữ liệu...</div>;

  return (
    <div className="panel">
      <h2>Tổng quan Trang trại</h2>
      
      {/* 4 Thẻ chỉ số KPI giữ nguyên... */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        {/* ... (Giữ nguyên code các thẻ KPI của bạn) ... */}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>Danh sách Khu vực</h3>
        {canCreateZone && (
          <button onClick={handleAddZone} style={{ padding: '10px 15px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            + Thêm Khu Vực
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '10px' }}>Mã Khu Vực</th>
              <th style={{ padding: '10px' }}>Loại Thủy Sản</th>
              <th style={{ padding: '10px' }}>Số Ao</th>
              <th style={{ padding: '10px' }}>Tổng Diện Tích (m2)</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data.zones.map(zone => (
              <tr key={zone.KhuVuc_ID} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>
                  <Link to={`/khu-vuc/${zone.KhuVuc_ID}/ao`} style={{ color: '#1890ff', fontWeight: 'bold', textDecoration: 'none' }}>
                    {zone.KhuVuc_ID}
                  </Link>
                </td>
                <td style={{ padding: '10px' }}>{zone.LoaiHaiSan}</td>
                <td style={{ padding: '10px' }}>{zone.so_ao}</td>
                <td style={{ padding: '10px' }}>{zone.tong_dien_tich || 0}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  {canUpdateZone && (
                    <button onClick={() => handleEditZone(zone.KhuVuc_ID, zone.LoaiHaiSan)} style={{ marginRight: '10px', padding: '5px 10px', cursor: 'pointer' }}>
                      Sửa
                    </button>
                  )}
                  {canDeleteZone && (
                    <button onClick={() => handleDeleteZone(zone.KhuVuc_ID)} style={{ padding: '5px 10px', background: '#ff4d4f', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;