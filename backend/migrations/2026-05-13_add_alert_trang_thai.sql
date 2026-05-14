CREATE TABLE IF NOT EXISTS `alert_trang_thai` (
  `ma_thiet_bi` varchar(50) NOT NULL,
  `alert_kind` varchar(30) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `previous_value` float DEFAULT NULL,
  `last_sensor_value` float DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `last_alert_id` bigint DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ma_thiet_bi`,`alert_kind`),
  KEY `idx_alert_kind` (`alert_kind`),
  CONSTRAINT `alert_trang_thai_ibfk_1` FOREIGN KEY (`ma_thiet_bi`) REFERENCES `cam_bien` (`ma_thiet_bi`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
