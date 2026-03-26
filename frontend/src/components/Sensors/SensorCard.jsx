// frontend/src/components/Sensors/SensorCard.jsx
import React from 'react';

const SensorCard = ({ sensor }) => {
    return (
        <div style={styles.card}>
            <h4 style={styles.title}>Cảm biến: {sensor.ThietBiTaiBien_ID}</h4>
            <div style={styles.value}>{Number(sensor.value).toFixed(1)}</div>
            <p style={styles.time}>
                Cập nhật: {new Date(sensor.created_at).toLocaleString('vi-VN')}
            </p>
        </div>
    );
};

const styles = {
    card: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        margin: '8px',
        backgroundColor: '#f9fafb',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        minWidth: '200px'
    },
    title: { margin: '0 0 10px 0', color: '#374151' },
    value: { fontSize: '24px', fontWeight: 'bold', color: '#2563eb' },
    time: { fontSize: '12px', color: '#6b7280', margin: '10px 0 0 0' }
};

export default SensorCard;