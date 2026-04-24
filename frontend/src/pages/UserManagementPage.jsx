import React, { useEffect, useState } from 'react';
import { getUsers, getZones, updateUserAreas, createUser, updateUserRole } from '../services/api';

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [zones, setZones] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ ten_dang_nhap: '', mat_khau: '', ma_role: 'worker' });

  // Giả lập check quyền admin từ Token (Bạn có thể lấy từ Context/Redux)
  const isAdmin = true; 

  const fetchData = () => {
    getUsers()
      .then(res => {
        if (res.error) console.error("Lỗi từ backend:", res.error);
        setUsers(Array.isArray(res) ? res : (res?.data || []));
      })
      .catch(console.error);
      
    getUsers().then(res => setUsers(Array.isArray(res) ? res : (res?.data || []))).catch(console.error);
    getZones().then(res => setZones(Array.isArray(res) ? res : (res?.data || []))).catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggleZone = async (userId, zoneId, isAssigned) => {
    const currentUser = users.find(u => u.ID === userId);
    if (!currentUser) return;

    const currentZones = currentUser.KhuVucQuanLy || []; 
    let newZones = currentZones.map(z => z.ID);
    
    if (isAssigned) newZones = newZones.filter(id => id !== zoneId);
    else newZones.push(zoneId);

    try {
      await updateUserAreas(userId, newZones);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      alert('Tạo người dùng thành công!');
      setShowAddForm(false);
      setNewUser({ ten_dang_nhap: '', mat_khau: '', ma_role: 'worker' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      alert('Cập nhật quyền thành công!');
      fetchData();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Quản lý Nhân sự & Phân vùng</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Hủy' : '+ Thêm Nhân sự'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateUser} style={{ background: '#f9f9f9', padding: '15px', marginBottom: '20px', borderRadius: '8px' }}>
          <h3>Tạo Tài khoản Mới</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <input type="text" placeholder="Tên đăng nhập" required
                   value={newUser.ten_dang_nhap} onChange={(e) => setNewUser({...newUser, ten_dang_nhap: e.target.value})} />
            <input type="password" placeholder="Mật khẩu" required
                   value={newUser.mat_khau} onChange={(e) => setNewUser({...newUser, mat_khau: e.target.value})} />
            <select value={newUser.ma_role} onChange={(e) => setNewUser({...newUser, ma_role: e.target.value})}>
              <option value="worker">Worker (Công nhân)</option>
              <option value="manager">Manager (Quản lý)</option>
              <option value="admin">Admin (Quản trị viên)</option>
            </select>
            <button type="submit" className="btn-primary">Lưu</button>
          </div>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Tên đăng nhập</th>
            <th style={{ padding: '12px' }}>Vai trò</th>
            <th style={{ padding: '12px' }}>Khu vực quản lý</th>
            <th style={{ padding: '12px' }}>Trạng thái</th>
            <th style={{ padding: '12px' }}>Gán khu vực</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(users) && users.map(user => {
            const khuVuc = user.KhuVucQuanLy || []; 
            return (
              <tr key={user.ID} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{user.TenDangNhap}</td>
                <td style={{ padding: '12px' }}>
                  {isAdmin ? (
                    <select 
                      value={user.Role_ID || 'worker'} 
                      onChange={(e) => handleChangeRole(user.ID, e.target.value)}
                      style={{ padding: '4px' }}
                    >
                      <option value="worker">Worker</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="badge">{user.RoleName}</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {khuVuc.length > 0 
                    ? khuVuc.map(z => z.ID).join(', ') 
                    : <span style={{ color: '#888', fontStyle: 'italic' }}>Chưa gán</span>}
                </td>
                <td style={{ padding: '12px' }}>
                  {/* Map trạng thái 1 thành Hoạt động, các trường hợp khác thành Khóa */}
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: user.TrangThai === 1 ? '#d4edda' : '#f8d7da',
                    color: user.TrangThai === 1 ? '#155724' : '#721c24'
                  }}>
                    {user.TrangThai === 1 ? 'Hoạt động' : 'Khóa'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {Array.isArray(zones) && zones.map(zone => {
                      const isAssigned = khuVuc.some(z => z.ID === zone.ID || z.ma_khu_vuc === zone.ID);
                      return (
                        <label key={zone.ID} style={{ fontSize: '13px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isAssigned} 
                            onChange={() => handleToggleZone(user.ID, zone.ID, isAssigned)}
                            style={{ marginRight: '4px' }}
                          /> 
                          {zone.ID}
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
             <tr>
               <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Đang tải dữ liệu...</td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagementPage;