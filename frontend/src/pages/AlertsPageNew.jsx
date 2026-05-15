import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { acknowledgeAlert, getAlerts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { normalizeAlertCollection } from '../utils/warning';

const AlertsPageNew = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('urgent');
  const [days, setDays] = useState('all');
  const [search, setSearch] = useState('');

  const fetchAlerts = async () => {
    const rows = await getAlerts(filter === 'all' ? '' : filter, {
      sort,
      days: days === 'all' ? undefined : Number(days)
    });
    setAlerts(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    fetchAlerts().catch((error) => alert(error.message));
  }, [filter, sort, days]);

  const visibleAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return normalizeAlertCollection(alerts).filter((item) => {
      if (!keyword) return true;
      return [
        item.displayDevice,
        item.displayLocation,
        item.displayDescription,
        item.meta.type,
        item.displayWorker
      ]
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
          <button type="button" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>Quay lại</button>
          <h2>Cảnh báo hệ thống</h2>
          <p style={{ margin: '6px 0 0', color: '#667085' }}>
            Chỉ hiển thị cảnh báo còn hiệu lực và đã có thay đổi trạng thái hoặc mức độ.
          </p>
        </div>
        <button type="button" onClick={fetchAlerts}>Tải lại</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm cảnh báo..." style={{ minWidth: 220 }} />
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="all">Toàn bộ thời gian</option>
          <option value="7">7 ngày</option>
          <option value="30">30 ngày</option>
          <option value="90">90 ngày</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả</option>
          <option value="unacknowledged">Chưa xử lý</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="urgent">Ưu tiên nguy hiểm</option>
          <option value="newest">Mới nhất</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Thiết bị</th>
              <th>Vị trí</th>
              <th>Mô tả</th>
              <th>Người phụ trách</th>
              <th>Trạng thái</th>
              <th>Mức độ</th>
            </tr>
          </thead>
          <tbody>
            {visibleAlerts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 16, textAlign: 'center' }}>Không có cảnh báo.</td>
              </tr>
            ) : visibleAlerts.map((log, index) => {
              const statusLabel = log.acknowledged ? 'Đã xử lý' : 'Chưa xử lý';
              return (
                <tr key={log.alertKey}>
                  <td>{index + 1}</td>
                  <td>{log.displayDevice}</td>
                  <td>{log.displayLocation}</td>
                  <td>{log.displayDescription}</td>
                  <td>{log.displayWorker}</td>
                  <td>{statusLabel}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, color: '#fff', background: log.severityColor }}>
                        {log.severityLabel}
                      </span>
                      {!log.acknowledged && hasPermission('alerts:ack') && log.ma_log && (
                        <button type="button" onClick={() => handleAck(log.ma_log)}>Đánh dấu</button>
                      )}
                    </div>
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

export default AlertsPageNew;
