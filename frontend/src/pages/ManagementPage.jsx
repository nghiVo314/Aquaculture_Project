import React, { useEffect, useState } from 'react';
import {
  addDevice,
  addPond,
  addStation,
  addZone,
  deleteDevice,
  deletePond,
  deleteStation,
  deleteZone,
  getDevices,
  getPonds,
  getStations,
  getZones
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const ManagementPage = () => {
  const { hasPermission } = useAuth(); // Dùng hàm kiểm tra quyền thay vì check Role tĩnh

  const [zones, setZones] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [stations, setStations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');

  const [zoneForm, setZoneForm] = useState({ ma_khu_vuc: '', loai_thuy_san: '' });
  const [pondForm, setPondForm] = useState({ ma_ao_nuoi: '', ma_khu_vuc: '', dien_tich: '' });
  const [stationForm, setStationForm] = useState({ ma_tram: '', ma_ao_nuoi: '', trang_thai_cloud: 'online' });
  const [deviceForm, setDeviceForm] = useState({ ma_thiet_bi: '', ma_tram: '', nhom_thiet_bi: 'sensor', loai_thiet_bi: '' });

  const loadAll = async () => {
    try {
      const [z, p, s, d] = await Promise.all([getZones(), getPonds(), getStations(), getDevices()]);
      setZones(z);
      setPonds(p);
      setStations(s);
      setDevices(d);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submitAction = async (action, reset) => {
    try {
      await action();
      reset();
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Quản lý khu vực ao nuôi</h2>
        <button type="button" onClick={loadAll}>
          Đồng bộ dữ liệu
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="grid-two">
        {/* KHU VỰC */}
        <article className="card">
          <h3>Khu vực</h3>
          {hasPermission('zone:create') && (
            <form
              className="mini-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAction(
                  () => addZone({ ...zoneForm }),
                  () => setZoneForm({ ma_khu_vuc: '', loai_thuy_san: '' })
                );
              }}
            >
              <input
                placeholder="Mã khu vực"
                value={zoneForm.ma_khu_vuc}
                onChange={(event) => setZoneForm((prev) => ({ ...prev, ma_khu_vuc: event.target.value }))}
                required
              />
              <input
                placeholder="Loại thủy sản"
                value={zoneForm.loai_thuy_san}
                onChange={(event) => setZoneForm((prev) => ({ ...prev, loai_thuy_san: event.target.value }))}
                required
              />
              <button type="submit">Thêm khu</button>
            </form>
          )}
          <ul className="item-list">
            {zones.map((zone) => (
              <li key={zone.ID}>
                <span>
                  {zone.ID} - {zone.LoaiHaiSan}
                </span>
                {hasPermission('zone:delete') && (
                  <button type="button" onClick={() => submitAction(() => deleteZone(zone.ID), () => {})}>
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>

        {/* AO NUÔI */}
        <article className="card">
          <h3>Ao nuôi</h3>
          {hasPermission('pond:create') && (
            <form
              className="mini-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAction(
                  () => addPond({ ...pondForm, dien_tich: Number(pondForm.dien_tich) }),
                  () => setPondForm({ ma_ao_nuoi: '', ma_khu_vuc: '', dien_tich: '' })
                );
              }}
            >
              <input
                placeholder="Mã ao"
                value={pondForm.ma_ao_nuoi}
                onChange={(event) => setPondForm((prev) => ({ ...prev, ma_ao_nuoi: event.target.value }))}
                required
              />
              <input
                placeholder="Mã khu vực"
                value={pondForm.ma_khu_vuc}
                onChange={(event) => setPondForm((prev) => ({ ...prev, ma_khu_vuc: event.target.value }))}
                required
              />
              <input
                placeholder="Diện tích"
                type="number"
                value={pondForm.dien_tich}
                onChange={(event) => setPondForm((prev) => ({ ...prev, dien_tich: event.target.value }))}
                required
              />
              <button type="submit">Thêm ao</button>
            </form>
          )}
          <ul className="item-list">
            {ponds.map((pond) => (
              <li key={pond.ma_ao_nuoi}>
                <span>
                  {pond.ma_ao_nuoi} - {pond.ma_khu_vuc}
                </span>
                {hasPermission('pond:delete') && (
                  <button type="button" onClick={() => submitAction(() => deletePond(pond.ma_ao_nuoi), () => {})}>
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>

        {/* TRẠM BIÊN */}
        <article className="card">
          <h3>Trạm biên</h3>
          {hasPermission('station:create') && (
            <form
              className="mini-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAction(
                  () => addStation(stationForm),
                  () => setStationForm({ ma_tram: '', ma_ao_nuoi: '', trang_thai_cloud: 'online' })
                );
              }}
            >
              <input
                placeholder="Mã trạm"
                value={stationForm.ma_tram}
                onChange={(event) => setStationForm((prev) => ({ ...prev, ma_tram: event.target.value }))}
                required
              />
              <input
                placeholder="Mã ao nuôi"
                value={stationForm.ma_ao_nuoi}
                onChange={(event) => setStationForm((prev) => ({ ...prev, ma_ao_nuoi: event.target.value }))}
                required
              />
              <select
                value={stationForm.trang_thai_cloud}
                onChange={(event) => setStationForm((prev) => ({ ...prev, trang_thai_cloud: event.target.value }))}
              >
                <option value="online">online</option>
                <option value="offline">offline</option>
              </select>
              <button type="submit">Thêm trạm</button>
            </form>
          )}
          <ul className="item-list">
            {stations.map((station) => (
              <li key={station.ma_tram}>
                <span>
                  {station.ma_tram} - {station.ma_ao_nuoi}
                </span>
                {hasPermission('station:delete') && (
                  <button type="button" onClick={() => submitAction(() => deleteStation(station.ma_tram), () => {})}>
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>

        {/* THIẾT BỊ */}
        <article className="card">
          <h3>Thiết bị</h3>
          {hasPermission('device:create') && (
            <form
              className="mini-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAction(
                  () => addDevice(deviceForm),
                  () => setDeviceForm({ ma_thiet_bi: '', ma_tram: '', nhom_thiet_bi: 'sensor', loai_thiet_bi: '' })
                );
              }}
            >
              <input
                placeholder="Mã thiết bị"
                value={deviceForm.ma_thiet_bi}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, ma_thiet_bi: event.target.value }))}
                required
              />
              <input
                placeholder="Mã trạm"
                value={deviceForm.ma_tram}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, ma_tram: event.target.value }))}
                required
              />
              <select
                value={deviceForm.nhom_thiet_bi}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, nhom_thiet_bi: event.target.value }))}
              >
                <option value="sensor">Cảm biến</option>
                <option value="control">Điều khiển</option>
              </select>
              <input
                placeholder="Loại thiết bị"
                value={deviceForm.loai_thiet_bi}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, loai_thiet_bi: event.target.value }))}
                required
              />
              <button type="submit">Thêm thiết bị</button>
            </form>
          )}
          <ul className="item-list">
            {devices.map((device) => (
              <li key={device.ma_thiet_bi}>
                <span>
                  {device.ma_thiet_bi} - {device.ma_tram}
                </span>
                {hasPermission('device:delete') && (
                  <button type="button" onClick={() => submitAction(() => deleteDevice(device.ma_thiet_bi), () => {})}>
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};

export default ManagementPage;