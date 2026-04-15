import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [TenDangNhap, setTenDangNhap] = useState('');
  const [MatKhau, setMatKhau] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(TenDangNhap, MatKhau);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Dang nhap he thong</h1>
        <p>He thong quan ly ao nuoi voi phan quyen ro rang.</p>

        <label htmlFor="username">Ten dang nhap</label>
        <input
          id="username"
          value={TenDangNhap}
          onChange={(event) => setTenDangNhap(event.target.value)}
          placeholder="admin"
          required
        />

        <label htmlFor="password">Mat khau</label>
        <input
          id="password"
          type="password"
          value={MatKhau}
          onChange={(event) => setMatKhau(event.target.value)}
          required
        />

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Dang dang nhap...' : 'Dang nhap'}
        </button>

        <span>
          Chua co tai khoan? <Link to="/register">Tao tai khoan</Link>
        </span>
      </form>
    </div>
  );
};

export default LoginPage;
