import React, { useEffect, useMemo, useState } from 'react';
import { getSystemLogs } from '../services/api';

const LOG_TYPE_LABELS = {
  LOGIN: 'Dang nhap',
  WARNING: 'Canh bao',
  AUTO_CONTROL: 'Tu dong dieu khien',
  DELETE_USER: 'Xoa nguoi dung'
};

const SOURCE_TYPE_LABELS = {
  AUTO: 'Tu dong',
  MANUAL: 'Thu cong'
};

const readToken = (text, name) => {
  const match = String(text || '').match(new RegExp(`\\[${name}:([^\\]]+)\\]`, 'i'));
  return match?.[1] || '';
};

const cleanDescription = (text) => String(text || '').replace(/\[[A-Z_]+:[^\]]+\]\s*/gi, '').trim();

const getLogTypeLabel = (type) => LOG_TYPE_LABELS[String(type || '').toUpperCase()] || (type || 'Khac');
const getSourceTypeLabel = (type) => SOURCE_TYPE_LABELS[String(type || '').toUpperCase()] || 'He thong';

const getStatusLabel = (log) => {
  if (String(log.log_type || '').toUpperCase() !== 'WARNING') return 'Thong tin';
  return log.acknowledged ? 'Da xu ly' : 'Chua xu ly';
};

const getStatusStyle = (log) => {
  if (String(log.log_type || '').toUpperCase() !== 'WARNING') {
    return { background: '#e0f2fe', color: '#0369a1' };
  }
  return log.acknowledged
    ? { background: '#dcfce7', color: '#166534' }
    : { background: '#fee2e2', color: '#991b1b' };
};

const buildScopeLabel = (log) => {
  const text = String(log.mo_ta || '');
  const pondId = readToken(text, 'POND');
  const sensorId = readToken(text, 'SENSOR');
  const actuatorId = readToken(text, 'ACTUATOR');

  if (pondId && sensorId) return `${pondId} / ${sensorId}`;
  if (pondId && actuatorId) return `${pondId} / ${actuatorId}`;
  if (pondId) return pondId;
  return '-';
};

const buildReadableLog = (log) => ({
  ...log,
  displayType: getLogTypeLabel(log.log_type),
  displaySource: getSourceTypeLabel(log.source_type),
  displayStatus: getStatusLabel(log),
  displayScope: buildScopeLabel(log),
  displayDescription: cleanDescription(log.mo_ta),
  displayActor: log.TenDangNhap || 'He thong'
});

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      const data = await getSystemLogs();
      setLogs(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const displayLogs = useMemo(() => logs.map(buildReadableLog), [logs]);

  const actorOptions = useMemo(() => {
    return Array.from(new Set(displayLogs.map((log) => log.displayActor).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'vi'));
  }, [displayLogs]);

  const filteredLogs = useMemo(() => {
    return displayLogs.filter((log) => {
      const matchesType = typeFilter === 'all' || String(log.log_type || '').toUpperCase() === typeFilter;
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'resolved' && log.acknowledged)
        || (statusFilter === 'open' && !log.acknowledged && String(log.log_type || '').toUpperCase() === 'WARNING');
      const matchesActor = actorFilter === 'all' || log.displayActor === actorFilter;
      const haystack = [
        log.displayType,
        log.displayDescription,
        log.displayActor,
        log.displayScope
      ].join(' ').toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return matchesType && matchesStatus && matchesActor && matchesSearch;
    });
  }, [actorFilter, displayLogs, search, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: displayLogs.length,
    warnings: displayLogs.filter((log) => String(log.log_type || '').toUpperCase() === 'WARNING').length,
    openWarnings: displayLogs.filter((log) => String(log.log_type || '').toUpperCase() === 'WARNING' && !log.acknowledged).length
  }), [displayLogs]);

  return (
    <section className="panel">
      <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Nhat ky he thong</h2>
          <div style={{ color: '#64748b', fontSize: '0.92em' }}>
            Loc nhanh theo thoi gian, loai su kien, pham vi ao, nguoi tao va trang thai xu ly.
          </div>
        </div>
        <button type="button" onClick={fetchLogs}>
          Tai lai
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: '0.9em' }}>Tong log</div>
          <div style={{ fontSize: '1.5em', fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: '0.9em' }}>Canh bao</div>
          <div style={{ fontSize: '1.5em', fontWeight: 700 }}>{stats.warnings}</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: '0.9em' }}>Chua xu ly</div>
          <div style={{ fontSize: '1.5em', fontWeight: 700 }}>{stats.openWarnings}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tim theo mo ta, ao, thiet bi, nguoi tao"
          style={{ minWidth: 260, padding: '8px 10px' }}
        />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ padding: '8px 10px' }}>
          <option value="all">Tat ca loai</option>
          <option value="WARNING">Canh bao</option>
          <option value="LOGIN">Dang nhap</option>
          <option value="AUTO_CONTROL">Tu dong dieu khien</option>
          <option value="DELETE_USER">Xoa nguoi dung</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: '8px 10px' }}>
          <option value="all">Tat ca trang thai</option>
          <option value="open">Chua xu ly</option>
          <option value="resolved">Da xu ly</option>
        </select>
        <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} style={{ padding: '8px 10px' }}>
          <option value="all">Tat ca nguoi tao</option>
          {actorOptions.map((actor) => (
            <option key={actor} value={actor}>{actor}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>Su kien</th>
              <th>Pham vi</th>
              <th>Noi dung</th>
              <th>Nguon</th>
              <th>Nguoi tao</th>
              <th>Trang thai</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 16 }}>
                  Khong co ban ghi phu hop.
                </td>
              </tr>
            ) : filteredLogs.map((log) => {
              const statusStyle = getStatusStyle(log);
              return (
                <tr key={log.ma_log}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.thoi_gian_khoi_tao).toLocaleString('vi-VN')}</td>
                  <td style={{ fontWeight: 600 }}>{log.displayType}</td>
                  <td>{log.displayScope}</td>
                  <td style={{ minWidth: 320 }}>
                    <div>{log.displayDescription || '-'}</div>
                    {String(log.mo_ta || '').includes('[') && (
                      <div style={{ color: '#64748b', fontSize: '0.82em', marginTop: 4 }}>
                        ID log: {log.ma_log}
                      </div>
                    )}
                  </td>
                  <td>{log.displaySource}</td>
                  <td>{log.displayActor}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.82em',
                        fontWeight: 700,
                        background: statusStyle.background,
                        color: statusStyle.color
                      }}
                    >
                      {log.displayStatus}
                    </span>
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

export default LogsPage;
