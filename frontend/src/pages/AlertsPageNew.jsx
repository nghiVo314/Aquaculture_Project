import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { acknowledgeAlert, getAlerts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { dedupeWarnings, getWarningSeverityLabel, parseWarningMeta, toWorkerName } from '../utils/warning';

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
    const parsedRows = dedupeWarnings(alerts)
      .map((item, index) => ({ ...item, meta: parseWarningMeta(item), stt: index + 1 }))
      .filter((item) => item.meta.severity !== 'ignore');

    return parsedRows.filter((item) => {
      if (!keyword) return true;
      return [item.meta.device, item.meta.areaText, item.meta.description, item.meta.type, item.TenDangNhap, toWorkerName(item)]
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
          <p style={{ margin: '6px 0 0', color: '#667085' }}>Cột hiển thị: STT - thiết bị - vị trí - mô tả - người xử lý - tình trạng.</p>
        </div>
        <button type="button" onClick={fetchAlerts}>tải lại</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm cảnh báo..." style={{ minWidth: 220 }} />
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="all">Tất cả ngày</option>
          <option value="7">7 ngày</option>
          <option value="30">30 ngày</option>
          <option value="90">90 ngày</option>
        </select>
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
              <th>STT</th>
              <th>Thiết bị</th>
              <th>Vị trí</th>
              <th>Mô tả</th>
              <th>Người xử lý</th>
              <th>Tình trạng</th>
              <th>Mức độ</th>
            </tr>
          </thead>
          <tbody>
            {visibleAlerts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 16, textAlign: 'center' }}>Không có cảnh báo.</td>
              </tr>
            ) : visibleAlerts.map((log, index) => {
              const severity = log.meta.severity;
              const severityLabel = getWarningSeverityLabel(severity);
              const statusLabel = log.acknowledged ? 'Đã xử lý' : 'Chưa xử lý';
              return (
                <tr key={log.ma_log}>
                  <td>{index + 1}</td>
                  <td>{log.meta.device || log.meta.sensorId || '-'}</td>
                  <td>{log.meta.areaText || '-'}</td>
                  <td>{log.meta.description || log.mo_ta}</td>
                  <td>{toWorkerName(log)}</td>
                  <td>{statusLabel}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, color: '#fff', background: severityLabel.color }}>
                        {severityLabel.label}
                      </span>
                      {!log.acknowledged && hasPermission('alerts:ack') && (
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
