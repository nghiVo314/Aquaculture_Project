import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { CSVLink } from 'react-csv';
import { getZones, getPonds, getReportSensors } from '../services/api';

const colors = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
  '#FF8042',
  '#0088FE',
  '#AA66CC'
];

const sensorOptions = {
  TEMP: {
    label: 'Nhiệt độ',
    unit: '°C'
  },
  LIGHT: {
    label: 'Ánh sáng',
    unit: '%'
  }
};

const ReportPage = () => {
  const [zones, setZones] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [reportData, setReportData] = useState([]);

  const [viewType, setViewType] = useState('chart');
  const [days, setDays] = useState(7);
  const [sensorType, setSensorType] = useState('TEMP');

  const [expandedPonds, setExpandedPonds] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentSensor = sensorOptions[sensorType];

  useEffect(() => {
    loadData();
  }, [days, sensorType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [zonesRes, pondsRes, sensorRows] = await Promise.all([
        getZones(),
        getPonds(),
        getReportSensors(days, sensorType)
      ]);

      const fetchedZones = Array.isArray(zonesRes)
        ? zonesRes
        : zonesRes?.data || [];

      const fetchedPonds = Array.isArray(pondsRes)
        ? pondsRes
        : pondsRes?.data || [];

      setZones(fetchedZones);
      setPonds(fetchedPonds);

      const grouped = {};

      sensorRows.forEach((row) => {
        const time = formatTime(row.thoi_gian);

        if (!grouped[time]) grouped[time] = { time };

        grouped[time][row.ma_ao_nuoi] = Number(row.gia_tri);
      });

      setReportData(Object.values(grouped));
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (value) => {
    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return value;

    return `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  const getZoneId = (zone) => zone.ma_khu_vuc || zone.ID;
  const getZoneName = (zone) =>
    zone.ten_khu_vuc || zone.ma_khu_vuc || zone.ID;

  const togglePond = (pondId) => {
    setExpandedPonds((prev) => ({
      ...prev,
      [pondId]: !prev[pondId]
    }));
  };

  const getRowsForPond = (pondId) => {
    return reportData.filter((row) => row[pondId] != null);
  };

  if (loading) {
    return (
      <div className="panel">
        <h2>Đang tải báo cáo...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div className="panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '15px',
          flexWrap: 'wrap'
        }}
      >
        <h2>Báo cáo theo khu vực</h2>

        <CSVLink
          data={reportData}
          filename={`bao-cao-${sensorType.toLowerCase()}.csv`}
          className="btn-primary"
        >
          Xuất CSV
        </CSVLink>
      </div>

      <div
        style={{
          margin: '20px 0',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
        </select>

        <select
          value={sensorType}
          onChange={(e) => setSensorType(e.target.value)}
        >
          <option value="TEMP">Nhiệt độ</option>
          <option value="LIGHT">Ánh sáng</option>
        </select>

        <button
          onClick={() =>
            setViewType(viewType === 'chart' ? 'table' : 'chart')
          }
        >
          {viewType === 'chart'
            ? 'Chuyển sang bảng'
            : 'Chuyển sang biểu đồ'}
        </button>
      </div>

      {zones.map((zone) => {
        const zoneId = getZoneId(zone);

        const zonePonds = ponds.filter(
          (p) => p.ma_khu_vuc === zoneId
        );

        if (!zonePonds.length) return null;

        return (
          <div
            key={zoneId}
            className="card"
            style={{
              marginBottom: '30px',
              padding: '20px'
            }}
          >
            <h3
              style={{
                borderBottom: '2px solid #eee',
                paddingBottom: '10px'
              }}
            >
              Khu vực: {getZoneName(zone)}

              <span
                style={{
                  fontSize: '14px',
                  marginLeft: '10px',
                  color: '#666'
                }}
              >
                ({zonePonds.length} ao nuôi)
              </span>
            </h3>

            {viewType === 'chart' ? (
              <div
                style={{
                  height: '360px',
                  marginTop: '20px'
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />

                    <YAxis
                      label={{
                        value: `${currentSensor.label} (${currentSensor.unit})`,
                        angle: -90,
                        position: 'insideLeft'
                      }}
                    />

                    <Tooltip />
                    <Legend />

                    {zonePonds.map((pond, idx) => (
                      <Line
                        key={pond.ma_ao_nuoi}
                        type="monotone"
                        dataKey={pond.ma_ao_nuoi}
                        name={pond.ma_ao_nuoi}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ marginTop: '20px' }}>
                {zonePonds.map((pond) => {
                  const pondId = pond.ma_ao_nuoi;
                  const pondRows = getRowsForPond(pondId);
                  const expanded = expandedPonds[pondId];

                  return (
                    <div
                      key={pondId}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        onClick={() => togglePond(pondId)}
                        style={{
                          padding: '14px',
                          background: '#f8f8f8',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>
                          <Link
                            to={`/ao-nuoi/${pondId}`}
                            onClick={(event) => event.stopPropagation()}
                            style={{ color: '#1677ff', textDecoration: 'none' }}
                          >
                            {pondId}
                          </Link>
                        </span>
                        <span>{expanded ? '▲' : '▼'}</span>
                      </div>

                      {expanded && (
                        <div style={{ overflowX: 'auto' }}>
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse'
                            }}
                          >
                            <thead style={{ background: '#fafafa' }}>
                              <tr>
                                <th style={thStyle}>Thời gian</th>
                                <th style={thStyle}>
                                  {currentSensor.label} ({currentSensor.unit})
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {pondRows.map((row, index) => (
                                <tr key={index}>
                                  <td style={tdStyle}>{row.time}</td>
                                  <td style={tdStyle}>
                                    {Number(
                                      row[pondId]
                                    ).toFixed(1)}
                                  </td>
                                </tr>
                              ))}

                              {!pondRows.length && (
                                <tr>
                                  <td
                                    colSpan="2"
                                    style={tdStyle}
                                  >
                                    Không có dữ liệu
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!reportData.length && (
        <div style={{ color: '#777' }}>
          Không có dữ liệu trong khoảng thời gian đã chọn.
        </div>
      )}
    </div>
  );
};

const thStyle = {
  border: '1px solid #ddd',
  padding: '10px',
  textAlign: 'center'
};

const tdStyle = {
  border: '1px solid #ddd',
  padding: '10px',
  textAlign: 'center'
};

export default ReportPage;