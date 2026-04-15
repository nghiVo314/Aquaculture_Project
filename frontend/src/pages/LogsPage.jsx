import React, { useEffect, useState } from 'react';
import { getSystemLogs } from '../services/api';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    try {
      const data = await getSystemLogs();
      setLogs(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Nhat ky he thong</h2>
        <button type="button" onClick={fetchLogs}>
          Tai lai
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>Loai</th>
              <th>Mo ta</th>
              <th>Nguoi tao</th>
              <th>Trang thai</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.ma_log}>
                <td>{new Date(log.thoi_gian_khoi_tao).toLocaleString('vi-VN')}</td>
                <td>{log.log_type}</td>
                <td>{log.mo_ta}</td>
                <td>{log.TenDangNhap || 'He thong'}</td>
                <td>{log.acknowledged ? 'Da xu ly' : 'Chua xu ly'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LogsPage;
