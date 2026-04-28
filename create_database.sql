CREATE DATABASE IF NOT EXISTS ql_ao_nuoi;
USE ql_ao_nuoi;

CREATE TABLE `nguoi_dung` (
  `ma_nguoi_dung` varchar(50) NOT NULL,
  `ten_dang_nhap` varchar(50) NOT NULL,
  `mat_khau` varchar(255) NOT NULL,
  `trang_thai` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ma_nguoi_dung`),
  UNIQUE KEY `ten_dang_nhap` (`ten_dang_nhap`)
);

CREATE TABLE `role` (
  `ma_role` varchar(20) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `mo_ta` text,
  PRIMARY KEY (`ma_role`)
);

CREATE TABLE `quyen` (
  `ma_quyen` varchar(50) NOT NULL,
  `ten_quyen` varchar(100) NOT NULL,
  PRIMARY KEY (`ma_quyen`)
);

CREATE TABLE `nguoi_dung_role` (
  `ma_nguoi_dung` varchar(50) NOT NULL,
  `ma_role` varchar(20) NOT NULL,
  PRIMARY KEY (`ma_nguoi_dung`,`ma_role`),
  FOREIGN KEY (`ma_nguoi_dung`) REFERENCES `nguoi_dung`(`ma_nguoi_dung`) ON DELETE CASCADE,
  FOREIGN KEY (`ma_role`) REFERENCES `role`(`ma_role`) ON DELETE CASCADE
);

CREATE TABLE `role_quyen` (
  `ma_role` varchar(20) NOT NULL,
  `ma_quyen` varchar(50) NOT NULL,
  PRIMARY KEY (`ma_role`,`ma_quyen`),
  FOREIGN KEY (`ma_role`) REFERENCES `role`(`ma_role`) ON DELETE CASCADE,
  FOREIGN KEY (`ma_quyen`) REFERENCES `quyen`(`ma_quyen`) ON DELETE CASCADE
);

CREATE TABLE `khu_vuc` (
  `ma_khu_vuc` varchar(50) NOT NULL,
  `ma_nguoi_dung_quan_ly` varchar(50) DEFAULT NULL,
  `loai_thuy_san` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ma_khu_vuc`),
  FOREIGN KEY (`ma_nguoi_dung_quan_ly`) REFERENCES `nguoi_dung`(`ma_nguoi_dung`) ON DELETE SET NULL
);

CREATE TABLE `ao_nuoi` (
  `ma_ao_nuoi` varchar(50) NOT NULL,
  `ma_khu_vuc` varchar(50) NOT NULL,
  `dien_tich` float DEFAULT NULL,
  `che_do` enum('AUTO','MANUAL') DEFAULT 'AUTO',
  PRIMARY KEY (`ma_ao_nuoi`),
  FOREIGN KEY (`ma_khu_vuc`) REFERENCES `khu_vuc`(`ma_khu_vuc`) ON DELETE CASCADE
);

CREATE TABLE `tram_bien` (
  `ma_tram` varchar(50) NOT NULL,
  `ma_ao_nuoi` varchar(50) NOT NULL,
  `trang_thai_cloud` varchar(50) DEFAULT 'CONNECTED',
  PRIMARY KEY (`ma_tram`),
  FOREIGN KEY (`ma_ao_nuoi`) REFERENCES `ao_nuoi`(`ma_ao_nuoi`) ON DELETE CASCADE
);

CREATE TABLE `thiet_bi_tai_bien` (
  `ma_thiet_bi` varchar(50) NOT NULL,
  `ma_tram` varchar(50) NOT NULL,
  `loai_phan_loai` enum('CAM_BIEN','DIEU_KHIEN') NOT NULL,
  `trang_thai` enum('HOAT_DONG','TAT','BAO_TRI') DEFAULT 'TAT',
  PRIMARY KEY (`ma_thiet_bi`),
  FOREIGN KEY (`ma_tram`) REFERENCES `tram_bien`(`ma_tram`) ON DELETE CASCADE
);

CREATE TABLE `cam_bien` (
  `ma_thiet_bi` varchar(50) NOT NULL,
  `loai_cam_bien` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ma_thiet_bi`),
  FOREIGN KEY (`ma_thiet_bi`) REFERENCES `thiet_bi_tai_bien`(`ma_thiet_bi`) ON DELETE CASCADE
);

CREATE TABLE `thiet_bi_dieu_khien` (
  `ma_thiet_bi` varchar(50) NOT NULL,
  `loai_thiet_bi` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ma_thiet_bi`),
  FOREIGN KEY (`ma_thiet_bi`) REFERENCES `thiet_bi_tai_bien`(`ma_thiet_bi`) ON DELETE CASCADE
);

CREATE TABLE `cong_thuc_cho_an` (
  `ma_cong_thuc` varchar(50) NOT NULL,
  `ti_le_cho_an` float DEFAULT NULL,
  `thong_tin_bo_sung` text,
  PRIMARY KEY (`ma_cong_thuc`)
);

CREATE TABLE `rule_dieu_khien` (
  `ma_rule` varchar(50) NOT NULL,
  `ma_cam_bien` varchar(50) NOT NULL,
  `ma_tb_dieu_khien` varchar(50) NOT NULL,
  `nguong_canh_bao` varchar(255) DEFAULT NULL,
  `min_value` float DEFAULT NULL,
  `max_value` float DEFAULT NULL,
  PRIMARY KEY (`ma_rule`),
  FOREIGN KEY (`ma_cam_bien`) REFERENCES `cam_bien`(`ma_thiet_bi`) ON DELETE CASCADE,
  FOREIGN KEY (`ma_tb_dieu_khien`) REFERENCES `thiet_bi_dieu_khien`(`ma_thiet_bi`) ON DELETE CASCADE
);

CREATE TABLE `du_lieu_quan_trac` (
  `ma_du_lieu` bigint NOT NULL AUTO_INCREMENT,
  `ma_cam_bien` varchar(50) NOT NULL,
  `thoi_gian` datetime NOT NULL,
  `gia_tri` float NOT NULL,
  PRIMARY KEY (`ma_du_lieu`),
  FOREIGN KEY (`ma_cam_bien`) REFERENCES `cam_bien`(`ma_thiet_bi`) ON DELETE CASCADE
);

CREATE TABLE `ghi_chep_cho_an` (
  `ma_ghi_chep` int NOT NULL AUTO_INCREMENT,
  `ma_cong_thuc` varchar(50) DEFAULT NULL,
  `ma_tb_dieu_khien` varchar(50) DEFAULT NULL,
  `thoi_gian_cho_an` datetime DEFAULT NULL,
  `muc_do_them_an` varchar(50) DEFAULT NULL,
  `bang_chung_hinh_anh` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_ghi_chep`),
  FOREIGN KEY (`ma_cong_thuc`) REFERENCES `cong_thuc_cho_an`(`ma_cong_thuc`) ON DELETE SET NULL,
  FOREIGN KEY (`ma_tb_dieu_khien`) REFERENCES `thiet_bi_dieu_khien`(`ma_thiet_bi`) ON DELETE CASCADE
);

INSERT INTO `nguoi_dung` VALUES
('USR_ADMIN','admin','admin',1),
('USR_MANAGER_01','manager1','123456',1),
('USR_QL01','quanly1','123456',1),
('USR_WORKER_01','worker1','123456',1),
('USR_WORKER_02','worker2','123456',1);

INSERT INTO `role` VALUES
('admin','Quản trị viên',NULL),
('manager','Quản lý',NULL),
('worker','Công nhân',NULL);

INSERT INTO `quyen` VALUES
('alerts:ack','Xác nhận xử lý cảnh báo'),
('device:create','Thêm thiết bị'),
('device:delete','Xóa thiết bị'),
('device:status:update','Điều khiển bật/tắt thiết bị');

INSERT INTO `nguoi_dung_role` VALUES
('USR_ADMIN','admin'),
('USR_MANAGER_01','manager'),
('USR_WORKER_01','worker'),
('USR_WORKER_02','worker');

INSERT INTO `role_quyen` VALUES
('admin','alerts:ack'),
('manager','alerts:ack'),
('worker','alerts:ack'),
('admin','device:create'),
('admin','device:delete'),
('admin','device:status:update');

INSERT INTO `khu_vuc` VALUES
('KV_01','USR_QL01','Tôm Thẻ Chân Trắng');

INSERT INTO `ao_nuoi` VALUES
('AO_01','KV_01',1000,'AUTO');

INSERT INTO `tram_bien` VALUES
('TRAM_AO_01','AO_01','CONNECTED');

INSERT INTO `thiet_bi_tai_bien` VALUES
('CB_TEMP_AO_01','TRAM_AO_01','CAM_BIEN','TAT'),
('DK_FAN_AO_01','TRAM_AO_01','DIEU_KHIEN','TAT'),
('DK_FEEDER_AO_01','TRAM_AO_01','DIEU_KHIEN','TAT'),
('DK_PUMP_AO_01','TRAM_AO_01','DIEU_KHIEN','TAT');

INSERT INTO `cam_bien` VALUES
('CB_TEMP_AO_01','TEMP');

INSERT INTO `thiet_bi_dieu_khien` VALUES
('DK_FAN_AO_01','FAN'),
('DK_FEEDER_AO_01','FEEDER'),
('DK_PUMP_AO_01','PUMP');

INSERT INTO `cong_thuc_cho_an` VALUES
('CT_GIAIDOAN_1',5.5,'Cho ăn giai đoạn tôm giống');

INSERT INTO `rule_dieu_khien` VALUES
('RULE_TEMP_AO_01','CB_TEMP_AO_01','DK_FAN_AO_01',NULL,25,26);