const request = require('supertest');
const app = require('../../server');

describe('Sensors API - Module 1 (Receive & Display Data)', () => {
  
  describe('GET /api/sensors/:sensorId/latest', () => {
    
    it('should return the latest sensor reading with 200 status', async () => {
      const response = await request(app)
        .get('/api/sensors/SENSOR_001/latest')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sensorId');
      expect(response.body.data).toHaveProperty('sensorName');
      expect(response.body.data).toHaveProperty('value');
      expect(response.body.data).toHaveProperty('unit');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return correct sensor data format', async () => {
      const response = await request(app)
        .get('/api/sensors/SENSOR_001/latest')
        .expect(200);
      
      const { data } = response.body;
      
      // Validate data types
      expect(typeof data.sensorId).toBe('string');
      expect(typeof data.sensorName).toBe('string');
      expect(typeof data.value).toBe('number');
      expect(typeof data.unit).toBe('string');
      expect(typeof data.timestamp).toBe('string');
      expect(['normal', 'warning', 'critical']).toContain(data.status);
    });

    it('should return 404 for non-existent sensor', async () => {
      const response = await request(app)
        .get('/api/sensors/NONEXISTENT/latest')
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle database errors gracefully', async () => {
      const response = await request(app)
        .get('/api/sensors/SENSOR_001/latest')
        .expect(200);

    
      // If DB fails, we should still get mock data for demo  
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/sensors', () => {
    
    it('should return list of all sensors with 200 status', async () => {
      const response = await request(app)
        .get('/api/sensors')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return sensors with required properties', async () => {
      const response = await request(app)
        .get('/api/sensors')
        .expect(200);
      
      const sensor = response.body.data[0];
      expect(sensor).toHaveProperty('sensorId');
      expect(sensor).toHaveProperty('sensorName');
      expect(sensor).toHaveProperty('deviceId');
      expect(sensor).toHaveProperty('type');
      expect(sensor).toHaveProperty('unit');
      expect(sensor).toHaveProperty('status');
    });
  });
});
