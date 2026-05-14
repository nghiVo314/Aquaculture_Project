-- ==============================================
-- MIGRATION: Thêm hỗ trợ nhiều workers cho ao
-- Thực thi các câu lệnh này theo thứ tự
-- ==============================================

-- BƯỚC 1: Xóa UNIQUE constraint cũ (nếu tồn tại)
-- ⚠️ LƯU Ý: Tên constraint có thể khác tùy vào cơ sở dữ liệu của bạn
ALTER TABLE ao_nuoi DROP INDEX IF EXISTS uniq_ao_worker;

-- BƯỚC 2: Tạo bảng mới ao_nuoi_workers
CREATE TABLE IF NOT EXISTS ao_nuoi_workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_ao_nuoi VARCHAR(50) NOT NULL,
    ma_nguoi_dung VARCHAR(50) NOT NULL,
    vai_tro ENUM('PRIMARY', 'MAINTENANCE', 'ASSISTANT') DEFAULT 'PRIMARY',
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Không cho phép gán cùng 1 worker 2 lần vào cùng ao (nhưng có thể 1 worker vào nhiều ao)
    UNIQUE KEY unique_pond_worker (ma_ao_nuoi, ma_nguoi_dung),
    
    -- Index để tìm nhanh workers của 1 ao
    INDEX idx_pond (ma_ao_nuoi),
    
    -- Index để tìm nhanh các ao của 1 worker
    INDEX idx_worker (ma_nguoi_dung),
    
    -- Foreign keys
    FOREIGN KEY (ma_ao_nuoi) REFERENCES ao_nuoi(ma_ao_nuoi) ON DELETE CASCADE,
    FOREIGN KEY (ma_nguoi_dung) REFERENCES nguoi_dung(ma_nguoi_dung) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- BƯỚC 3: (OPTIONAL) Migrate dữ liệu cũ từ cột ma_nguoi_dung_phu_trach
-- Nếu bạn đã có dữ liệu trong ao_nuoi.ma_nguoi_dung_phu_trach, 
-- copy nó sang bảng mới:
INSERT INTO ao_nuoi_workers (ma_ao_nuoi, ma_nguoi_dung, vai_tro)
SELECT ma_ao_nuoi, ma_nguoi_dung_phu_trach, 'PRIMARY'
FROM ao_nuoi
WHERE ma_nguoi_dung_phu_trach IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ao_nuoi_workers 
    WHERE ma_ao_nuoi = ao_nuoi.ma_ao_nuoi 
      AND ma_nguoi_dung = ao_nuoi.ma_nguoi_dung_phu_trach
  );

-- BƯỚC 4: (OPTIONAL) Giữ cột cũ để backward compatibility
-- Hoặc bạn có thể xóa cột nếu đã chắc chắn không cần
-- ALTER TABLE ao_nuoi DROP COLUMN ma_nguoi_dung_phu_trach;

-- BƯỚC 5: Tạo view để dễ lấy "primary worker" của ao (cho backward compatibility)
CREATE OR REPLACE VIEW ao_nuoi_primary_worker AS
SELECT 
    a.ma_ao_nuoi,
    COALESCE(aow.ma_nguoi_dung, a.ma_nguoi_dung_phu_trach) as ma_nguoi_dung_phu_trach,
    u.ten_dang_nhap as nguoi_phu_trach
FROM ao_nuoi a
LEFT JOIN ao_nuoi_workers aow ON a.ma_ao_nuoi = aow.ma_ao_nuoi 
    AND aow.vai_tro = 'PRIMARY'
LEFT JOIN nguoi_dung u ON COALESCE(aow.ma_nguoi_dung, a.ma_nguoi_dung_phu_trach) = u.ma_nguoi_dung;

-- ==============================================
-- KIỂM TRA: Xem dữ liệu sau migration
-- ==============================================
-- SELECT * FROM ao_nuoi_workers;
-- SELECT * FROM ao_nuoi_primary_worker;

-- ==============================================
-- THÊM PERMISSIONS MỚI VÀO DATABASE
-- ==============================================

-- Nếu bạn dùng hệ thống permission, thêm quyền này:
INSERT IGNORE INTO quyen (ma_quyen, ten_quyen) VALUES
('pond:manage:workers', 'Quản lý công nhân cho ao'),
('pond:update:config', 'Sửa cấu hình ao (ngưỡng, chế độ)');

-- Gán quyền cho manager
INSERT IGNORE INTO role_quyen (ma_role, ma_quyen) VALUES
('manager', 'pond:manage:workers'),
('manager', 'pond:update:config');

-- Gán quyền cho admin
INSERT IGNORE INTO role_quyen (ma_role, ma_quyen) VALUES
('admin', 'pond:manage:workers'),
('admin', 'pond:update:config');

-- ==============================================
-- KHÔI PHỤC DỮ LIỆU (nếu cần)
-- ==============================================
-- 
-- Nếu bạn muốn roll back:
-- DROP TABLE IF EXISTS ao_nuoi_workers;
-- ALTER TABLE ao_nuoi ADD UNIQUE KEY uniq_ao_worker (ma_nguoi_dung_phu_trach);