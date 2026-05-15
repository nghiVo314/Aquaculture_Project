import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';

// Import các trang cơ bản
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import LogsPage from './pages/LogsPage';
import ManagementPage from './pages/ManagementPage';
import RegisterPage from './pages/RegisterPage';
// import ControlPanelPage from './pages/ControlPanelPage';
import AlertsPage from './pages/AlertsPageNew';

// Import các trang MỚI BỔ SUNG
import UserManagementPage from './pages/UserManagementPage';
// import SchedulePage from './pages/SchedulePage';
import PondDetailPage from './pages/PondDetailPage';
import ReportPage from './pages/ReportPage';

//trang bổ sung để coi danh sách ao khi nhấn vào khu vực
import ZonePondsPage from './pages/ZonePondsPage';

// Import Context và Layout
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/Layout/MainLayout';

// Component bảo vệ Route: Chưa đăng nhập thì văng ra trang Login
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Component bảo vệ theo Role (Đã cập nhật cho chuẩn RBAC mới)
const RoleRoute = ({ children, allow }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  // Hệ thống RBAC mới lưu roles dưới dạng mảng (VD: ['admin', 'manager'])
  // Kiểm tra xem user có ít nhất 1 role nằm trong danh sách cho phép (allow) không
  const hasRole = user.roles?.some(role => allow.includes(role));
  
  return hasRole ? children : <Navigate to="/" replace />;
};

// Quản lý toàn bộ định tuyến
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      
      {/* Cấu trúc các trang bên trong MainLayout (có Sidebar/Header) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Các trang chung (Ai đăng nhập cũng vào được, dữ liệu lọc theo quyền ở backend) */}
        <Route index element={<DashboardPage />} />
        {/* ROUTE MỚI: Danh sách ao của một khu vực */}
        <Route path="khu-vuc/:zoneId/ao" element={<ZonePondsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="logs" element={<LogsPage />} />
        {/* <Route path="control" element={<ControlPanelPage />} />
        <Route path="schedules" element={<SchedulePage />} /> */}
        <Route path="reports" element={<ReportPage />} />
        <Route path="ao-nuoi/:id" element={<PondDetailPage />} />
        
        {/* Trang Quản lý Không gian & Thiết bị: Chỉ Admin và Manager mới vào được */}
        <Route
          path="management"
          element={
            <RoleRoute allow={['admin', 'manager']}>
              <ManagementPage />
            </RoleRoute>
          }
        />

        {/* Trang Quản lý User: CHỈ DÀNH CHO ADMIN */}
        <Route
          path="users"
          element={
            <RoleRoute allow={['admin']}>
              <UserManagementPage />
            </RoleRoute>
          }
        />
      </Route>

      {/* Bắt các link sai */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
};

// Component gốc bọc toàn bộ App
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
