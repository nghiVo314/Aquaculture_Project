import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    TenDangNhap: '',
    MatKhau: '',
    RoleName: 'worker'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await register(form);
      setSuccess('Tao tai khoan thanh cong. Ban co the dang nhap ngay.');
      setTimeout(() => navigate('/login'), 800);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Tao tai khoan</h1>
        <p>Mat khau duoc luu don gian theo yeu cau de tai.</p>

        <label htmlFor="reg-username">Ten dang nhap</label>
        <input
          id="reg-username"
          value={form.TenDangNhap}
          onChange={(event) => onChange('TenDangNhap', event.target.value)}
          required
        />

        <label htmlFor="reg-password">Mat khau</label>
        <input
          id="reg-password"
          type="password"
          value={form.MatKhau}
          onChange={(event) => onChange('MatKhau', event.target.value)}
          required
        />

        <label htmlFor="role">Vai tro</label>
        <select id="role" value={form.RoleName} onChange={(event) => onChange('RoleName', event.target.value)}>
          <option value="admin">Admin</option>
          <option value="worker">Cong nhan van hanh</option>
          <option value="manager">Manager</option>
        </select>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        <button type="submit">Tao tai khoan</button>

        <span>
          Da co tai khoan? <Link to="/login">Dang nhap</Link>
        </span>
      </form>
    </div>
  );
};

export default RegisterPage;
