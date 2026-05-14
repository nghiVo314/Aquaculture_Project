-- Helper functions for warning severity and noise filtering.
-- Run this once on the MySQL database if you want database-side classification.

DELIMITER $$

DROP FUNCTION IF EXISTS fn_warning_is_noise $$
CREATE FUNCTION fn_warning_is_noise(p_text TEXT)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    DECLARE t TEXT;
    SET t = LOWER(COALESCE(p_text, ''));

    IF t LIKE '%type:offline%' THEN
        RETURN 1;
    END IF;

    IF t LIKE '%chưa có dữ liệu%' THEN
        RETURN 1;
    END IF;

    RETURN 0;
END $$

DROP FUNCTION IF EXISTS fn_warning_severity $$
CREATE FUNCTION fn_warning_severity(p_text TEXT)
RETURNS VARCHAR(16)
DETERMINISTIC
BEGIN
    DECLARE t TEXT;
    SET t = LOWER(COALESCE(p_text, ''));

    IF fn_warning_is_noise(t) = 1 THEN
        RETURN 'ignore';
    END IF;

    IF t LIKE '%[severity:critical]%' THEN
        RETURN 'critical';
    END IF;

    IF t LIKE '%[severity:warning]%' THEN
        RETURN 'warning';
    END IF;

    IF t LIKE '%[severity:caution]%' THEN
        RETURN 'caution';
    END IF;

    RETURN 'warning';
END $$

DELIMITER ;
