import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { acknowledgeAlert, getAlerts } from '../services/api';
import { useAuth } from '../context/AuthContext';

const statusStyles = {
  critical: { label: 'Gấp', bg: '#dc2626' },
  warning: { label: 'Cảnh báo', bg: '#f97316' },
  caution: { label: 'Cần chú ý', bg: '#eab308' },
  normal: { label: 'Bình thường', bg: '#16a34a' },
};

const resolveSeverity = (log) => {
  const text = String(log.mo_ta || '').toLowerCase();
  if (text.includes('threshold') || text.includes('offline') || text.includes('vượt ngưỡng')) return 'critical';
  if (text.includes('thấp hơn ngưỡng') || text.includes('cần chú ý')) return 'warning';
  return 'caution';
};

const AlertsPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('urgent');
  const [search, setSearch] = useState('');

  const fetchAlerts = async () => {
    const rows = await getAlerts(filter === 'all' ? '' : filter, { sort });
    setAlerts(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    fetchAlerts().catch((error) => alert(error.message));
  }, [filter, sort]);

  const visibleAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return alerts.filter((item) => {
      if (!keyword) return true;
      return [item.mo_ta, item.log_type, item.TenDangNhap]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [alerts, search]);

  const handleAck = async (logId) => {
    await acknowledgeAlert(logId);
    await fetchAlerts();
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <button type="button" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Quay lại</button>
          <h2>Cảnh báo hệ thống</h2>
        </div>
        <button type="button" onClick={fetchAlerts}>tải lại</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm cảnh báo..." style={{ minWidth: 220 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="unacknowledged">Chưa xử lý</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="urgent">Cần xử lý gấp</option>
          <option value="newest">Mới nhất</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Mức độ</th>
              <th>Mô tả</th>
              <th>Người tạo</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {visibleAlerts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 16, textAlign: 'center' }}>Không có cảnh báo.</td>
              </tr>
            ) : visibleAlerts.map((log) => {
              const severity = resolveSeverity(log);
              const severityStyle = statusStyles[severity] || statusStyles.caution;
              return (
                <tr key={log.ma_log}>
                  <td>{new Date(log.thoi_gian_khoi_tao).toLocaleString('vi-VN')}</td>
                  <td><span style={{ padding: '4px 10px', borderRadius: 999, color: '#fff', background: severityStyle.bg }}>{severityStyle.label}</span></td>
                  <td>{log.mo_ta}</td>
                  <td>{log.TenDangNhap || 'Hệ thống'}</td>
                  <td>{log.acknowledged ? 'Đã xử lý' : 'Chưa xử lý'}</td>
                  <td>
                    {!log.acknowledged && hasPermission('alerts:ack') && (
                      <button type="button" onClick={() => handleAck(log.ma_log)}>Đánh dấu</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AlertsPage;