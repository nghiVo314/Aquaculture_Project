import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.jpg';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.roles?.includes('admin');
  const isManagerOrAdmin = user?.roles?.some((r) =>
    ['admin', 'manager'].includes(r)
  );

  const menuItems = [
    { label: 'Dashboard', path: '/' },
    // { label: 'Điều khiển', path: '/control' },
    // { label: 'Lịch trình', path: '/schedules' },
    { label: 'Báo cáo', path: '/reports' },
    { label: 'Nhật ký', path: '/logs' },
  ];

  return (
    <div style={styles.wrapper}>
      {/* HEADER */}
      <header style={styles.header}>
        {/* LEFT */}
        <div style={styles.brand}>
          <img src={logo} alt="Logo" style={styles.logo} />
          <div>
            <h1 style={styles.title}>Aqua Farm Control</h1>
            <p style={styles.subtitle}>Smart Aquaculture Monitoring System</p>
          </div>
        </div>

        {/* CENTER MENU */}
        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.link,
                ...(location.pathname === item.path
                  ? styles.activeLink
                  : {}),
              }}
            >
              {item.label}
            </Link>
          ))}

          {/* {isManagerOrAdmin && (
            <Link
              to="/management"
              style={{
                ...styles.link,
                ...(location.pathname === '/management'
                  ? styles.activeOrange
                  : styles.orange),
              }}
            >
              Quản lý Trại
            </Link>
          )} */}

          {isAdmin && (
            <Link
              to="/users"
              style={{
                ...styles.link,
                ...(location.pathname === '/users'
                  ? styles.activeRed
                  : styles.red),
              }}
            >
              Quản lý User
            </Link>
          )}
        </nav>

        {/* RIGHT */}
        <div style={styles.right}>
          <div style={styles.userBox}>
            <span style={styles.userText}>
              Xin chào,{' '}
              <strong>
                {user?.username || user?.TenDangNhap || 'User'}
              </strong>
            </span>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main style={styles.main}>
        <div style={styles.contentCard}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #e0f7fa 0%, #f5fbff 50%, #d9f0ff 100%)',
    fontFamily: 'Segoe UI, sans-serif',
  },

  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    padding: '16px 32px',
    background: 'rgba(15, 52, 67, 0.92)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  logo: {
    width: '62px',
    height: '62px',
    objectFit: 'cover',
    borderRadius: '50%',
    background: '#fff',
    padding: '4px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
  },

  title: {
    margin: 0,
    color: '#fff',
    fontSize: '1.4rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },

  subtitle: {
    margin: 0,
    color: '#b8dce8',
    fontSize: '0.8rem',
  },

  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    justifyContent: 'center',
    flex: 1,
  },

  link: {
    textDecoration: 'none',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    background: 'rgba(255,255,255,0.08)',
    transition: '0.3s ease',
  },

  activeLink: {
    background: '#00bcd4',
    boxShadow: '0 6px 18px rgba(0,188,212,0.35)',
  },

  orange: {
    background: '#e67e22',
  },

  activeOrange: {
    background: '#ff9800',
    boxShadow: '0 6px 18px rgba(255,152,0,0.35)',
  },

  red: {
    background: '#c0392b',
  },

  activeRed: {
    background: '#e74c3c',
    boxShadow: '0 6px 18px rgba(231,76,60,0.35)',
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  userBox: {
    background: 'rgba(255,255,255,0.08)',
    padding: '8px 14px',
    borderRadius: '12px',
  },

  userText: {
    color: '#e8f6fa',
    fontSize: '14px',
  },

  logoutBtn: {
    border: 'none',
    padding: '10px 18px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #00bcd4, #008CBA)',
    color: '#fff',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(0,140,186,0.3)',
  },

  main: {
    padding: '30px',
  },

  contentCard: {
    background: 'rgba(255,255,255,0.75)',
    borderRadius: '22px',
    padding: '25px',
    minHeight: 'calc(100vh - 140px)',
    boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(12px)',
  },
};

export default MainLayout;