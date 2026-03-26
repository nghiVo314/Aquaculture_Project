const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT a.*, t.ma_tram, t.trang_thai_cloud 
            FROM ao_nuoi a
            LEFT JOIN tram_bien t ON a.ma_ao_nuoi = t.ma_ao_nuoi
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD pond (Thêm ao nuôi mới vào một khu vực)
router.post('/', async (req, res) => {
    // Lấy các trường dữ liệu theo đúng chuẩn schema2
    const { ma_ao_nuoi, ma_khu_vuc, dien_tich } = req.body; 
    
    try {
        //kiểm tra giới hạn ao (VD: Tối đa 3 ao / 1 khu vực)
        const [result] = await db.execute(
            'SELECT COUNT(*) as total FROM ao_nuoi WHERE ma_khu_vuc = ?', 
            [ma_khu_vuc]
        );
        
        if (result[0].total >= 3) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Khu vực này đã đạt tối đa 3 ao nuôi!' 
            });
        }

        // Insert vào bảng ao_nuoi
        await db.execute(
            'INSERT INTO ao_nuoi (ma_ao_nuoi, ma_khu_vuc, dien_tich) VALUES (?, ?, ?)',
            [ma_ao_nuoi, ma_khu_vuc, dien_tich]
        );
        
        res.json({ status: 'added', message: 'Thêm ao nuôi thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET config for Gateway (Lấy ngưỡng hiện tại của ao để gửi cho main.py)
router.get('/:ao_id/config', async (req, res) => {
    try {
        // Truy xuất từ rule_dieu_khien dựa trên mã ao nuôi
        const [configs] = await db.execute(
            `SELECT cb.loai_cam_bien AS LoaiCamBien, r.min_value, r.max_value, r.ma_rule
             FROM rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             WHERE tb.ma_ao_nuoi = ?`,
            [req.params.ao_id]
        );
        res.json({ ao_id: req.params.ao_id, configs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT config from Dashboard (Cập nhật ngưỡng từ giao diện web)
router.put('/:ao_id/config', async (req, res) => {
    const { LoaiCamBien, min_value, max_value } = req.body;
    try {
        // Cập nhật bảng rule_dieu_khien dựa trên mã ao và loại cảm biến
        const [result] = await db.execute(
            `UPDATE rule_dieu_khien r
             JOIN cam_bien cb ON r.ma_cam_bien = cb.ma_thiet_bi
             JOIN thiet_bi_tai_bien tbtb ON cb.ma_thiet_bi = tbtb.ma_thiet_bi
             JOIN tram_bien tb ON tbtb.ma_tram = tb.ma_tram
             SET r.min_value = ?, r.max_value = ?
             WHERE tb.ma_ao_nuoi = ? AND cb.loai_cam_bien = ?`,
            [min_value, max_value, req.params.ao_id, LoaiCamBien]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy rule cho cảm biến này trong ao' });
        }
        res.json({ status: 'updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE thông tin ao (VD: Sửa diện tích)
router.put('/:id', async (req, res) => {
    const { dien_tich } = req.body;
    try {
        await db.execute(
            'UPDATE ao_nuoi SET dien_tich = ? WHERE ma_ao_nuoi = ?',
            [dien_tich, req.params.id]
        );
        res.json({ status: 'updated', message: 'Cập nhật ao thành công' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE ao nuôi
router.delete('/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM ao_nuoi WHERE ma_ao_nuoi = ?', [req.params.id]);
        res.json({ status: 'deleted', message: 'Đã xóa ao nuôi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;;