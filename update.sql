--! dtb bo sung de test tinh nang


USE ql_ao_nuoi;

-- =========================================================
-- 1) Users / Roles / Permissions
-- =========================================================
INSERT IGNORE INTO role (ma_role, role_name, mo_ta) VALUES
('admin', 'Quản trị viên', 'Toàn quyền'),
('manager', 'Quản lý', 'Quản lý khu vực/ao'),
('worker', 'Công nhân vận hành', 'Kỹ thuật viên vận hành');

INSERT IGNORE INTO quyen (ma_quyen, ten_quyen) VALUES
('alerts:ack', 'Xác nhận cảnh báo'),
('device:create', 'Thêm thiết bị'),
('device:delete', 'Xóa thiết bị'),
('device:status:update', 'Cập nhật trạng thái thiết bị'),
('pond:create', 'Thêm ao nuôi'),
('pond:delete', 'Xóa ao nuôi'),
('pond:update', 'Cập nhật ao nuôi'),
('pond:update:config', 'Cập nhật ngưỡng cảnh báo ao'),
('station:create', 'Thêm trạm'),
('station:delete', 'Xóa trạm'),
('zone:create', 'Thêm khu vực'),
('zone:delete', 'Xóa khu vực'),
('zone:update', 'Cập nhật khu vực');

INSERT IGNORE INTO role_quyen (ma_role, ma_quyen) VALUES
('admin', 'alerts:ack'),
('admin', 'device:create'),
('admin', 'device:delete'),
('admin', 'device:status:update'),
('admin', 'pond:create'),
('admin', 'pond:delete'),
('admin', 'pond:update'),
('admin', 'pond:update:config'),
('admin', 'station:create'),
('admin', 'station:delete'),
('admin', 'zone:create'),
('admin', 'zone:delete'),
('admin', 'zone:update'),
('manager', 'alerts:ack'),
('manager', 'device:status:update'),
('manager', 'pond:update:config'),
('worker', 'alerts:ack'),
('worker', 'device:status:update');

INSERT IGNORE INTO nguoi_dung (ma_nguoi_dung, ten_dang_nhap, mat_khau, trang_thai) VALUES
('USR_ADMIN_02', 'admin2', '123456', 1),
('USR_MANAGER_02', 'manager2', '123456', 1),
('USR_MANAGER_03', 'manager3', '123456', 1),
('USR_MANAGER_04', 'manager4', '123456', 1),
('USR_WORKER_03', 'worker3', '123456', 1),
('USR_WORKER_04', 'worker4', '123456', 1),
('USR_WORKER_05', 'worker5', '123456', 1),
('USR_WORKER_06', 'worker6', '123456', 1),
('USR_WORKER_07', 'worker7', '123456', 1),
('USR_WORKER_08', 'worker8', '123456', 1);

INSERT IGNORE INTO nguoi_dung_role (ma_nguoi_dung, ma_role) VALUES
('USR_ADMIN_02', 'admin'),
('USR_MANAGER_02', 'manager'),
('USR_MANAGER_03', 'manager'),
('USR_MANAGER_04', 'manager'),
('USR_WORKER_03', 'worker'),
('USR_WORKER_04', 'worker'),
('USR_WORKER_05', 'worker'),
('USR_WORKER_06', 'worker'),
('USR_WORKER_07', 'worker'),
('USR_WORKER_08', 'worker');

-- =========================================================
-- 2) Zones / Ponds
-- =========================================================
INSERT IGNORE INTO khu_vuc (ma_khu_vuc, ma_nguoi_dung_quan_ly, loai_thuy_san) VALUES
('KV_02', 'USR_MANAGER_02', 'Tôm Sú'),
('KV_03', 'USR_MANAGER_02', 'Tôm Thẻ'),
('KV_04', 'USR_MANAGER_03', 'Cá Rô Phi'),
('KV_05', 'USR_MANAGER_03', 'Cá Chép'),
('KV_06', 'USR_MANAGER_04', 'Cá Tra'),
('KV_07', 'USR_MANAGER_04', 'Tôm Hùm');

INSERT IGNORE INTO ao_nuoi (ma_ao_nuoi, ma_khu_vuc, dien_tich, che_do) VALUES
('AO_02', 'KV_02', 800, 'AUTO'),
('AO_03', 'KV_02', 950, 'AUTO'),
('AO_04', 'KV_02', 1100, 'MANUAL'),
('AO_05', 'KV_03', 1200, 'AUTO'),
('AO_06', 'KV_03', 900, 'AUTO'),
('AO_07', 'KV_04', 1000, 'AUTO'),
('AO_08', 'KV_04', 1400, 'MANUAL'),
('AO_09', 'KV_05', 1300, 'AUTO'),
('AO_10', 'KV_06', 1050, 'AUTO'),
('AO_11', 'KV_06', 990, 'AUTO'),
('AO_12', 'KV_07', 1500, 'AUTO');

-- =========================================================
-- 3) Stations / Devices / Rules
-- =========================================================
INSERT IGNORE INTO tram_bien (ma_tram, ma_ao_nuoi, trang_thai_cloud) VALUES
('TRAM_AO_02', 'AO_02', 'CONNECTED'),
('TRAM_AO_03', 'AO_03', 'CONNECTED'),
('TRAM_AO_04', 'AO_04', 'CONNECTED'),
('TRAM_AO_05', 'AO_05', 'CONNECTED'),
('TRAM_AO_06', 'AO_06', 'CONNECTED'),
('TRAM_AO_07', 'AO_07', 'CONNECTED'),
('TRAM_AO_08', 'AO_08', 'CONNECTED'),
('TRAM_AO_09', 'AO_09', 'CONNECTED'),
('TRAM_AO_10', 'AO_10', 'CONNECTED'),
('TRAM_AO_11', 'AO_11', 'CONNECTED'),
('TRAM_AO_12', 'AO_12', 'CONNECTED');

-- Sensors
INSERT IGNORE INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, loai_phan_loai, trang_thai) VALUES
('CB_TEMP_AO_02','TRAM_AO_02','CAM_BIEN','ON'),('CB_LIGHT_AO_02','TRAM_AO_02','CAM_BIEN','ON'),
('CB_TEMP_AO_03','TRAM_AO_03','CAM_BIEN','ON'),('CB_LIGHT_AO_03','TRAM_AO_03','CAM_BIEN','ON'),
('CB_TEMP_AO_04','TRAM_AO_04','CAM_BIEN','ON'),('CB_LIGHT_AO_04','TRAM_AO_04','CAM_BIEN','ON'),
('CB_TEMP_AO_05','TRAM_AO_05','CAM_BIEN','ON'),('CB_LIGHT_AO_05','TRAM_AO_05','CAM_BIEN','ON'),
('CB_TEMP_AO_06','TRAM_AO_06','CAM_BIEN','ON'),('CB_LIGHT_AO_06','TRAM_AO_06','CAM_BIEN','ON'),
('CB_TEMP_AO_07','TRAM_AO_07','CAM_BIEN','ON'),('CB_LIGHT_AO_07','TRAM_AO_07','CAM_BIEN','ON'),
('CB_TEMP_AO_08','TRAM_AO_08','CAM_BIEN','ON'),('CB_LIGHT_AO_08','TRAM_AO_08','CAM_BIEN','ON'),
('CB_TEMP_AO_09','TRAM_AO_09','CAM_BIEN','ON'),('CB_LIGHT_AO_09','TRAM_AO_09','CAM_BIEN','ON'),
('CB_TEMP_AO_10','TRAM_AO_10','CAM_BIEN','ON'),('CB_LIGHT_AO_10','TRAM_AO_10','CAM_BIEN','ON'),
('CB_TEMP_AO_11','TRAM_AO_11','CAM_BIEN','ON'),('CB_LIGHT_AO_11','TRAM_AO_11','CAM_BIEN','ON'),
('CB_TEMP_AO_12','TRAM_AO_12','CAM_BIEN','ON'),('CB_LIGHT_AO_12','TRAM_AO_12','CAM_BIEN','ON');

INSERT IGNORE INTO cam_bien (ma_thiet_bi, loai_cam_bien) VALUES
('CB_TEMP_AO_02','TEMP'),('CB_LIGHT_AO_02','LIGHT'),
('CB_TEMP_AO_03','TEMP'),('CB_LIGHT_AO_03','LIGHT'),
('CB_TEMP_AO_04','TEMP'),('CB_LIGHT_AO_04','LIGHT'),
('CB_TEMP_AO_05','TEMP'),('CB_LIGHT_AO_05','LIGHT'),
('CB_TEMP_AO_06','TEMP'),('CB_LIGHT_AO_06','LIGHT'),
('CB_TEMP_AO_07','TEMP'),('CB_LIGHT_AO_07','LIGHT'),
('CB_TEMP_AO_08','TEMP'),('CB_LIGHT_AO_08','LIGHT'),
('CB_TEMP_AO_09','TEMP'),('CB_LIGHT_AO_09','LIGHT'),
('CB_TEMP_AO_10','TEMP'),('CB_LIGHT_AO_10','LIGHT'),
('CB_TEMP_AO_11','TEMP'),('CB_LIGHT_AO_11','LIGHT'),
('CB_TEMP_AO_12','TEMP'),('CB_LIGHT_AO_12','LIGHT');

-- Actuators
INSERT IGNORE INTO thiet_bi_tai_bien (ma_thiet_bi, ma_tram, loai_phan_loai, trang_thai) VALUES
('DK_FAN_AO_02','TRAM_AO_02','DIEU_KHIEN','OFF'),('DK_PUMP_AO_02','TRAM_AO_02','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_02','TRAM_AO_02','DIEU_KHIEN','OFF'),
('DK_FAN_AO_03','TRAM_AO_03','DIEU_KHIEN','OFF'),('DK_PUMP_AO_03','TRAM_AO_03','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_03','TRAM_AO_03','DIEU_KHIEN','OFF'),
('DK_FAN_AO_04','TRAM_AO_04','DIEU_KHIEN','OFF'),('DK_PUMP_AO_04','TRAM_AO_04','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_04','TRAM_AO_04','DIEU_KHIEN','OFF'),
('DK_FAN_AO_05','TRAM_AO_05','DIEU_KHIEN','OFF'),('DK_PUMP_AO_05','TRAM_AO_05','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_05','TRAM_AO_05','DIEU_KHIEN','OFF'),
('DK_FAN_AO_06','TRAM_AO_06','DIEU_KHIEN','OFF'),('DK_PUMP_AO_06','TRAM_AO_06','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_06','TRAM_AO_06','DIEU_KHIEN','OFF'),
('DK_FAN_AO_07','TRAM_AO_07','DIEU_KHIEN','OFF'),('DK_PUMP_AO_07','TRAM_AO_07','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_07','TRAM_AO_07','DIEU_KHIEN','OFF'),
('DK_FAN_AO_08','TRAM_AO_08','DIEU_KHIEN','OFF'),('DK_PUMP_AO_08','TRAM_AO_08','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_08','TRAM_AO_08','DIEU_KHIEN','OFF'),
('DK_FAN_AO_09','TRAM_AO_09','DIEU_KHIEN','OFF'),('DK_PUMP_AO_09','TRAM_AO_09','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_09','TRAM_AO_09','DIEU_KHIEN','OFF'),
('DK_FAN_AO_10','TRAM_AO_10','DIEU_KHIEN','OFF'),('DK_PUMP_AO_10','TRAM_AO_10','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_10','TRAM_AO_10','DIEU_KHIEN','OFF'),
('DK_FAN_AO_11','TRAM_AO_11','DIEU_KHIEN','OFF'),('DK_PUMP_AO_11','TRAM_AO_11','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_11','TRAM_AO_11','DIEU_KHIEN','OFF'),
('DK_FAN_AO_12','TRAM_AO_12','DIEU_KHIEN','OFF'),('DK_PUMP_AO_12','TRAM_AO_12','DIEU_KHIEN','OFF'),('DK_FEEDER_AO_12','TRAM_AO_12','DIEU_KHIEN','OFF');

INSERT IGNORE INTO thiet_bi_dieu_khien (ma_thiet_bi, loai_thiet_bi) VALUES
('DK_FAN_AO_02','FAN'),('DK_PUMP_AO_02','PUMP'),('DK_FEEDER_AO_02','FEEDER'),
('DK_FAN_AO_03','FAN'),('DK_PUMP_AO_03','PUMP'),('DK_FEEDER_AO_03','FEEDER'),
('DK_FAN_AO_04','FAN'),('DK_PUMP_AO_04','PUMP'),('DK_FEEDER_AO_04','FEEDER'),
('DK_FAN_AO_05','FAN'),('DK_PUMP_AO_05','PUMP'),('DK_FEEDER_AO_05','FEEDER'),
('DK_FAN_AO_06','FAN'),('DK_PUMP_AO_06','PUMP'),('DK_FEEDER_AO_06','FEEDER'),
('DK_FAN_AO_07','FAN'),('DK_PUMP_AO_07','PUMP'),('DK_FEEDER_AO_07','FEEDER'),
('DK_FAN_AO_08','FAN'),('DK_PUMP_AO_08','PUMP'),('DK_FEEDER_AO_08','FEEDER'),
('DK_FAN_AO_09','FAN'),('DK_PUMP_AO_09','PUMP'),('DK_FEEDER_AO_09','FEEDER'),
('DK_FAN_AO_10','FAN'),('DK_PUMP_AO_10','PUMP'),('DK_FEEDER_AO_10','FEEDER'),
('DK_FAN_AO_11','FAN'),('DK_PUMP_AO_11','PUMP'),('DK_FEEDER_AO_11','FEEDER'),
('DK_FAN_AO_12','FAN'),('DK_PUMP_AO_12','PUMP'),('DK_FEEDER_AO_12','FEEDER');

INSERT IGNORE INTO rule_dieu_khien (ma_rule, ma_cam_bien, ma_tb_dieu_khien, min_value, max_value) VALUES
('RULE_TEMP_AO_02','CB_TEMP_AO_02','DK_FAN_AO_02',25,28),('RULE_LIGHT_AO_02','CB_LIGHT_AO_02','DK_FEEDER_AO_02',9,40),
('RULE_TEMP_AO_03','CB_TEMP_AO_03','DK_FAN_AO_03',25,28),('RULE_LIGHT_AO_03','CB_LIGHT_AO_03','DK_FEEDER_AO_03',9,40),
('RULE_TEMP_AO_04','CB_TEMP_AO_04','DK_FAN_AO_04',25,28),('RULE_LIGHT_AO_04','CB_LIGHT_AO_04','DK_FEEDER_AO_04',9,40),
('RULE_TEMP_AO_05','CB_TEMP_AO_05','DK_FAN_AO_05',25,28),('RULE_LIGHT_AO_05','CB_LIGHT_AO_05','DK_FEEDER_AO_05',9,40),
('RULE_TEMP_AO_06','CB_TEMP_AO_06','DK_FAN_AO_06',25,28),('RULE_LIGHT_AO_06','CB_LIGHT_AO_06','DK_FEEDER_AO_06',9,40),
('RULE_TEMP_AO_07','CB_TEMP_AO_07','DK_FAN_AO_07',25,28),('RULE_LIGHT_AO_07','CB_LIGHT_AO_07','DK_FEEDER_AO_07',9,40),
('RULE_TEMP_AO_08','CB_TEMP_AO_08','DK_FAN_AO_08',25,28),('RULE_LIGHT_AO_08','CB_LIGHT_AO_08','DK_FEEDER_AO_08',9,40),
('RULE_TEMP_AO_09','CB_TEMP_AO_09','DK_FAN_AO_09',25,28),('RULE_LIGHT_AO_09','CB_LIGHT_AO_09','DK_FEEDER_AO_09',9,40),
('RULE_TEMP_AO_10','CB_TEMP_AO_10','DK_FAN_AO_10',25,28),('RULE_LIGHT_AO_10','CB_LIGHT_AO_10','DK_FEEDER_AO_10',9,40),
('RULE_TEMP_AO_11','CB_TEMP_AO_11','DK_FAN_AO_11',25,28),('RULE_LIGHT_AO_11','CB_LIGHT_AO_11','DK_FEEDER_AO_11',9,40),
('RULE_TEMP_AO_12','CB_TEMP_AO_12','DK_FAN_AO_12',25,28),('RULE_LIGHT_AO_12','CB_LIGHT_AO_12','DK_FEEDER_AO_12',9,40);

-- =========================================================
-- 4) Formulas / sample schedules
-- =========================================================
INSERT IGNORE INTO cong_thuc_cho_an (ma_cong_thuc, ti_le_cho_an, thong_tin_bo_sung) VALUES
('CT_MORNING', 1.2, 'Khẩu phần buổi sáng'),
('CT_NOON', 1.5, 'Khẩu phần buổi trưa'),
('CT_EVENING', 1.1, 'Khẩu phần buổi chiều');

INSERT INTO lich_trinh (ma_lich_trinh, ma_tb_dieu_khien, thoi_gian_bat_dau, thoi_gian_ket_thuc, ma_cong_thuc) 
VALUES 
(9001, 'DK_FEEDER_AO_02', '06:00:00', '06:20:00', 'CT_MORNING'), 
(9002, 'DK_FEEDER_AO_02', '12:00:00', '12:20:00', 'CT_NOON'), 
(9003, 'DK_FEEDER_AO_02', '18:00:00', '18:20:00', 'CT_EVENING')
ON DUPLICATE KEY UPDATE 
ma_tb_dieu_khien = VALUES(ma_tb_dieu_khien),
thoi_gian_bat_dau = VALUES(thoi_gian_bat_dau),
thoi_gian_ket_thuc = VALUES(thoi_gian_ket_thuc),
ma_cong_thuc = VALUES(ma_cong_thuc);

