# 🌾 Aquaculture Management System - Backend API

**Hệ thống Quản lý và Vận hành Thủy sản Thông minh Tích hợp AI/IoT**

---

## 📋 TABLE OF CONTENTS
1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Database Setup](#database-setup)
6. [Running the Project](#running-the-project)
7. [Testing (TDD)](#testing-tdd)
8. [API Endpoints](#api-endpoints)
9. [Development Guidelines](#development-guidelines)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

**Prerequisites:**
- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

**3-minute setup:**
```bash
# 1. Clone & install
git clone <repo>
cd Aquaculture/backend
npm install

# 2. Setup MySQL
mysql -u root -p
CREATE DATABASE aquaculture_db;
USE aquaculture_db;
SOURCE DATABASE_SCHEMA.sql;  # Import schema + test data

# 3. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Run tests
npm run test:once

# 5. Start server
npm start
```

Server runs at: `http://localhost:5000`

---

## 📁 Project Structure

```
backend/
├── routes/
│   ├── sensors.js              # Module 1: Sensor data endpoints
|   ├── dashboard.js            # Dashboard summary endpoint (TODO)
│   ├── zones.js                # Zone management
│   ├── ponds.js                # Pond management
│   ├── devices.js              # Device control (Module 3)
│   ├── alerts.js               # Alert management (Module 2)
│   ├── logs.js                 # Activity/system logs (Module 4)
│   └── __tests__/
│       └── sensors.test.js     # Jest test suite (6 tests)
│
├── services/
│   ├── db.js                   # MySQL connection pool
│   ├── zoneService.js          # Zone business logic
│   ├── pondService.js          # Pond business logic
│   ├── sensorService.js        # Sensor business logic
│   └── alertService.js         # Alert business logic
│
├── middlewares/
│   ├── auth.js                 # JWT authentication (TODO)
│   └── errorHandler.js         # Global error handling (TODO)
│
├── server.js                   # Express app entry point
├── package.json                # Dependencies
├── jest.config.js              # Jest configuration
│
├── DATABASE_SCHEMA.sql         # Complete DB schema (Module 1-5)
├── API_ENDPOINTS.md            # Full API specification
└── .env.example                # Environment variables template
```

---

## 📦 Installation

### 1. **Prerequisites Check**
```bash
node --version    # Should be v18+
npm --version     # Should be v8+
mysql --version   # Should be v8.0+
```

### 2. **Install Dependencies**
```bash
cd backend
npm install
```

This installs:
- **express** - Web framework
- **mysql2** - MySQL driver (async/await support)
- **cors** - Cross-origin requests
- **dotenv** - Environment variables
- **jest** - Testing framework
- **supertest** - HTTP assertions for testing

### 3. **Verify Installation**
```bash
npm list  # See installed packages
```

---

## ⚙️ Configuration

### **Create .env file:**
```bash
cp .env.example .env
```

### **Edit .env:**
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=aquaculture_db

# Server
PORT=5000
NODE_ENV=development

# Optional
LOG_LEVEL=debug
API_VERSION=v1
```

---

## 🗄️ Database Setup

### **Option 1: Import Complete Schema (Recommended)**

```bash
# 1. Login to MySQL
mysql -u root -p

# 2. Create database
CREATE DATABASE aquaculture_db;

# 3. Exit MySQL
exit

# 4. Import schema from project root
mysql -u root -p aquaculture_db < DATABASE_SCHEMA.sql
```

### **Verify Setup:**
```bash
mysql -u root -p aquaculture_db
SHOW TABLES;                           # Should see 15+ tables
SELECT COUNT(*) FROM zones;            # Should see 3
SELECT COUNT(*) FROM sensors;          # Should see 4
SELECT COUNT(*) FROM users;            # Should see 4
```

---

## 🏃 Running the Project

### **Development Mode (with auto-reload)**
```bash
npm run dev
# Requires: npm install -g nodemon (or not if installed locally)
```

### **Production Mode**
```bash
npm start
```

### **Run Tests (TDD)**
```bash
# Run all tests (watch mode)
npm run test

# Run once (CI/CD)
npm run test:once

# Run specific test file
npm test routes/__tests__/sensors.test.js
```

### **Expected Output:**

```
✅ Tests passing:
PASS  routes/__tests__/sensors.test.js
  Sensors API - Module 1 (Receive & Display Data)
    GET /api/sensors/:sensorId/latest
      ✓ should return the latest sensor reading with 200 status (89 ms)
      ✓ should return correct sensor data format (9 ms)
      ✓ should return 404 for non-existent sensor (5 ms)
      ✓ should handle database errors gracefully (5 ms)
    GET /api/sensors
      ✓ should return list of all sensors with 200 status (5 ms)
      ✓ should return sensors with required properties (6 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

---

## 🧪 Testing (TDD Workflow)

### **Understanding TDD in This Project**

We follow **Test-Driven Development**:
1. **Tests already written** (in `routes/__tests__/`) ✅
2. **Implement code to make tests pass** (your job)
3. **Keep tests GREEN** as you code

### **Test Philosophy:**

```javascript
// tests/sensors.test.js DEFINES THE SPEC
describe('GET /api/sensors/:sensorId/latest', () => {
  it('should return sensor reading with correct format', () => {
    // This test DEFINES what the API must return
    // Your code must satisfy this test
  });
});
```

### **Run Tests Frequently:**

```bash
# While developing:
npm run test              # Watch mode - auto-runs on file change

# Before committing:
npm run test:once        # Single run - see final results
```

### **Adding New Tests:**

If adding new endpoints, create test file:
```javascript
// routes/__tests__/newFeature.test.js
describe('New Feature API', () => {
  it('should do something', async () => {
    const response = await request(app)
      .get('/api/new-endpoint')
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

---

## 📡 API Endpoints

### **Module 1: Sensors & Zones (MVP - 23/03)**

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/zones` | List all zones | ✅ Test Ready |
| GET | `/api/zones/:zoneId/ponds` | List ponds in zone | ✅ Test Ready |
| GET | `/api/sensors` | List all sensors | ✅ Test Ready |
| GET | `/api/sensors/:sensorId/latest` | Latest sensor reading | ✅ Test Ready |
| GET | `/api/sensors/:sensorId/history` | Sensor history (24h) | ✅ Test Ready |
| GET | `/api/ponds/:pondCode/farming-cycle` | Current cycle info | 🔄 Todo |
| GET | `/api/dashboard/status` | Dashboard summary | 🔄 Todo |

**Full specification:** See `API_ENDPOINTS.md`

### **Example API Call:**

```bash
# Get latest sensor reading
curl -X GET http://localhost:5000/api/sensors/SENSOR_A01_DO/latest

# Response:
{
  "success": true,
  "data": {
    "sensorId": "SENSOR_A01_DO",
    "sensorName": "DO Sensor - Pond A01",
    "value": 6.8,
    "unit": "mg/L",
    "status": "normal",
    "timestamp": "2026-03-19T10:29:50Z"
  }
}
```

---

## 👨‍💻 Development Guidelines

### **Code Style & Standards**

1. **Follow existing patterns** (see routes/sensors.js)
2. **Use async/await** (not callbacks)
3. **Error handling** - always include try/catch
4. **Logging** - use console.log for now (TODO: proper logger)
5. **Comments** - explain WHY, not WHAT

### **Example Implementation:**

```javascript
// routes/sensors.js
const express = require('express');
const router = express.Router();
const pool = require('../services/db');

/**
 * GET /api/sensors
 * Returns all sensors with latest readings
 */
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [sensors] = await connection.query('SELECT * FROM sensors');
    connection.release();

    res.status(200).json({
      success: true,
      data: sensors
    });
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sensors',
      error: error.message
    });
  }
});

module.exports = router;
```

### **Response Format (Standard)**

All endpoints must follow:

**Success:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2026-03-19T10:30:00Z"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human readable error",
  "code": "ERROR_CODE",
  "timestamp": "2026-03-19T10:30:00Z"
}
```

### **Git Workflow**

```bash
# 1. Create branch for feature
git checkout -b feat/sensor-api

# 2. Make changes + test
npm run test:once

# 3. Commit (keep tests GREEN)
git add .
git commit -m "feat: implement sensor endpoints"

# 4. Push
git push origin feat/sensor-api

# 5. Create Pull Request (PT4 reviews)
```

---

## 📊 Database Query Examples

### **Get all sensors for a pond:**
```javascript
const [sensors] = await pool.query(
  `SELECT s.* FROM sensors s
   JOIN edge_stations es ON s.stationId = es.id
   WHERE es.pondId = ?`,
  [pondId]
);
```

### **Get latest reading for sensor:**
```javascript
const [readings] = await pool.query(
  `SELECT * FROM readings 
   WHERE sensorId = ? 
   ORDER BY receivedAt DESC 
   LIMIT 1`,
  [sensorId]
);
```

### **Track alert status:**
```javascript
const [alerts] = await pool.query(
  `SELECT * FROM alerts 
   WHERE status = 'active' 
   AND cycleId = ?
   ORDER BY triggeredAt DESC`,
  [cycleId]
);
```

See `DATABASE_SCHEMA.sql` for full schema documentation.

---

## 🐛 Troubleshooting

### **Tests failing despite correct code?**

**Q: `Cannot find module '../server'`**
```bash
# A: Check path in test - should be ../../server for nested __tests__
```

**Q: `MySQL connection refused`**
```bash
# A: Check .env file
# A: Check MySQL is running: mysql -u root -p
# A: Check credentials: DB_HOST, DB_USER, DB_PASSWORD
```

**Q: `Database 'aquaculture_db' doesn't exist`**
```bash
# A: Import schema:
mysql -u root -p aquaculture_db < DATABASE_SCHEMA.sql
```

### **Port already in use?**

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=5001
```

### **Node modules issues?**

```bash
# Clear cache & reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📈 Development Timeline

| Phase | Dates | Milestone | Status |
|-------|-------|-----------|--------|
| **MVP** | 19-23/03 | Module 1 (Sensors) Demo | 🔄 |
| **Extended** | 23-27/03 | Module 2 (Alerts) + Real Data | 📅 |
| **Features** | 27-30/03 | Module 3-4 (Control + Logs) | 📅 |
| **Polish** | 30/03-27/04 | Tests + Optimization | 📅 |

---

## 📞 Need Help?

- **API spec unclear?** → See `API_ENDPOINTS.md`
- **Database schema?** → See `DATABASE_SCHEMA.sql`
- **TDD workflow?** → See `TDD_WORKFLOW.md`
- **Frontend integration?** → See `../frontend/FRONTEND_STRUCTURE.md`

---

## ✅ Checklist Before Demo (23/03)

- [ ] MySQL setup complete + schema imported
- [ ] npm install successful
- [ ] All 6 tests passing: `npm run test:once`
- [ ] Server starts: `npm start`
- [ ] GET /api/sensors returns data
- [ ] GET /api/sensors/:sensorId/latest returns latest reading
- [ ] Frontend can connect and display data
- [ ] Demo video recorded (Module 1 working)

---


## 📝 License

Multidisciplinary Project - Faculty of Computer Science and Engineering, HCMUT - Semester 252

---

**Happy Coding! 🚀**
