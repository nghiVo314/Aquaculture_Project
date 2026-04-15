import React, { createContext, useContext, useMemo, useState } from 'react';
import { loginApi, registerApi } from '../services/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'aq_token';
const USER_KEY = 'aq_user';

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(safeParse(localStorage.getItem(USER_KEY)));

  const login = async (TenDangNhap, MatKhau) => {
    const response = await loginApi(TenDangNhap, MatKhau);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user); // user lúc này đã có mảng .permissions và .roles từ Backend
    return response.user;
  };

  const register = async (payload) => registerApi(payload);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken('');
    setUser(null);
  };

  // Hàm tiện ích để kiểm tra quyền
  const hasPermission = (permissionString) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionString);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      hasPermission // Export thêm hàm này
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};