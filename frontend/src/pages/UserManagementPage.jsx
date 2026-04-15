import React, { useEffect, useState } from 'react';
import { getUsers, getZones, updateUserAreas } from '../services/api';

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    getUsers().then(setUsers);
    getZones().then(setZones);
  }, []);

  const handleToggleZone = async (userId, zoneId, isAssigned) => {
    const currentUser = users.find(u => u.ID === userId);
    let newZones = currentUser.KhuVucQuanLy.map(z => z.ID);
    
    if (isAssigned) {
      newZones = newZones.filter(id => id !== zoneId);
    } else {
      newZones.push(zoneId);
    }

    try {
      await updateUserAreas(userId, newZones);
      getUsers().then(setUsers); // Refresh dữ liệu
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="panel">
      <h2>Quản lý Nhân sự & Phân vùng</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Tên đăng nhập</th>
            <th style={{ padding: '12px' }}>Vai trò</th>
            <th style={{ padding: '12px' }}>Khu vực đang quản lý</th>
            <th style={{ padding: '12px' }}>Gán khu vực</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.ID} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '12px' }}>{user.TenDangNhap}</td>
              <td style={{ padding: '12px' }}><span className="badge">{user.RoleName}</span></td>
              <td style={{ padding: '12px' }}>
                {user.KhuVucQuanLy.map(z => z.ID).join(', ') || 'Chưa gán'}
              </td>
              <td style={{ padding: '12px' }}>
                {zones.map(zone => {
                  const isAssigned = user.KhuVucQuanLy.some(z => z.ID === zone.ID);
                  return (
                    <label key={zone.ID} style={{ marginRight: '10px', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={isAssigned} 
                        onChange={() => handleToggleZone(user.ID, zone.ID, isAssigned)}
                      /> {zone.ID}
                    </label>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagementPage;