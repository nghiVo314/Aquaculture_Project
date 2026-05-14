-- Triggers to auto-generate IDs for khu_vuc and ao_nuoi when not provided
DELIMITER $$

CREATE TRIGGER trg_khu_vuc_before_insert
BEFORE INSERT ON khu_vuc
FOR EACH ROW
BEGIN
  IF NEW.ma_khu_vuc IS NULL OR NEW.ma_khu_vuc = '' THEN
    DECLARE maxid INT DEFAULT 0;
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ma_khu_vuc, '_', -1) AS UNSIGNED)), 0) INTO maxid FROM khu_vuc;
    SET NEW.ma_khu_vuc = CONCAT('KV_', LPAD(maxid + 1, 2, '0'));
  END IF;
END$$

CREATE TRIGGER trg_ao_nuoi_before_insert
BEFORE INSERT ON ao_nuoi
FOR EACH ROW
BEGIN
  IF NEW.ma_ao_nuoi IS NULL OR NEW.ma_ao_nuoi = '' THEN
    DECLARE maxid INT DEFAULT 0;
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ma_ao_nuoi, '_', -1) AS UNSIGNED)), 0) INTO maxid FROM ao_nuoi;
    SET NEW.ma_ao_nuoi = CONCAT('AO_', LPAD(maxid + 1, 2, '0'));
  END IF;
END$$

DELIMITER ;
