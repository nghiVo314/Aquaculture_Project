import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Check quyền để hiển thị menu tương ứng
  const isAdmin = user?.roles?.includes('admin');
  const isManagerOrAdmin = user?.roles?.some(r => ['admin', 'manager'].includes(r));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      
      {/* THANH MENU BÊN TRÊN */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '15px 30px', backgroundColor: '#0f3443', color: 'white', flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Aqua Farm Control
        </div>
        
        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/" style={linkStyle}>Dashboard</Link>
          <Link to="/control" style={linkStyle}>Điều khiển</Link>
          <Link to="/schedules" style={linkStyle}>Lịch trình</Link>
          <Link to="/reports" style={linkStyle}>Báo cáo</Link>
          <Link to="/logs" style={linkStyle}>Nhật ký</Link>
          
          {/* Nút đặc quyền */}
          {isManagerOrAdmin && (
            <Link to="/management" style={{...linkStyle, backgroundColor: '#d35400'}}>Quản lý Trại</Link>
          )}
          {isAdmin && (
            <Link to="/users" style={{...linkStyle, backgroundColor: '#c0392b'}}>Quản lý User</Link>
          )}
        </nav>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', color: '#ccc' }}>
            Xin chào, {user?.username || user?.TenDangNhap}
          </span>
          <button 
            onClick={handleLogout} 
            style={{ padding: '8px 15px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* NỘI DUNG TRANG SẼ ĐƯỢC BƠM VÀO ĐÂY */}
      <main style={{ padding: '20px', flex: 1 }}>
        <Outlet /> 
      </main>
      
    </div>
  );
};

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  padding: '8px 12px',
  borderRadius: '4px',
  backgroundColor: 'rgba(255,255,255,0.1)',
  fontWeight: '500',
  fontSize: '14px'
};

export default MainLayout;