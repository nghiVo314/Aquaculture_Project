# 🌾 Aquaculture Management System (DADN Project)

**Hệ thống Quản lý và Vận hành Thủy sản Thông minh - AQUACULTUREFarm**

---

## 📖 Quick Navigation

| Component | Location | Status | Lead |
|-----------|----------|--------|------|
| **Backend API** | [backend/README.md](backend/README.md) | 🟢 Ready (TDD setup) | Person 2-3 |
| **Frontend Dashboard** | [frontend/README.md](frontend/README.md) | 🟢 Ready (Architecture designed) | Person 4 |
| **Database Schema** | [backend/DATABASE_SCHEMA.sql](backend/DATABASE_SCHEMA.sql) | 🟢 Ready (15 tables) | Person 1 |
| **API Specification** | [backend/API_ENDPOINTS.md](backend/API_ENDPOINTS.md) | 🟢 Ready (22 endpoints) | All |
| **Development Workflow** | [backend/TDD_WORKFLOW.md](backend/TDD_WORKFLOW.md) | 🟢 Ready (3-day timeline) | All |
| **Frontend Architecture** | [frontend/FRONTEND_STRUCTURE.md](frontend/FRONTEND_STRUCTURE.md) | 🟢 Ready (Components + hooks) | Person 4 |

---

## 🎯 Project Overview

### **What We're Building**
Real-time aquaculture monitoring dashboard for KHONGCOTEN farm with:
- **3 farming zones** (Shrimp A, Fish B, Settling C)
- **20+ ponds** with 40+ sensors each
- **Real-time sensor readings** (DO, pH, Temperature, Salinity, ORP)
- **Live dashboard** with charts and alerts
- **Edge computing** with Adafruit IoT devices
- **Activity audit logs** for compliance

### **Tech Stack**

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend** | Node.js + Express | 18.x + 5.2 | API server (REST endpoints) |
| **Frontend** | React + Vite | Latest | Real-time dashboard UI |
| **Database** | MySQL | 8.0+ | Time-series sensor data |
| **Charts** | Recharts | Latest | Real-time visualization |
| **Testing** | Jest + Supertest | Latest | Test-Driven Development |
| **IoT** | Adafruit IO | API | Mock data until 27/03 |

### **Architecture**
```
┌──────────────────────────────────────────────────────┐
│                 FRONTEND (React)                      │
│        http://localhost:5173 (Vite dev server)       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Sidebar] → [Dashboard] → [SensorCards + Charts]   │
│      ↓              ↓                ↓                │
│   GET /zones  GET /sensors   GET /readings (poll)   │
│                                                       │
├──────────────────────────────────────────────────────┤
│                  BACKEND (Express)                    │
│        http://localhost:5000 (Node API server)      │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Auth] → [Routes] → [Services] → [Database Pool]  │
│  /zones   /sensors   db.js        MySQL async       │
│  /ponds   /readings                                  │
│  /alerts                                             │
│                                                       │
├──────────────────────────────────────────────────────┤
│                  DATABASE (MySQL)                     │
│           localhost:3306 (KHONGCOTEN)               │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Tables: zones, ponds, sensors, readings,           │
│          devices, alerts, logs, users...            │
│  17M records/day (high-volume time-series)          │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 5-Minute Setup (All 3 Services)

### **Prerequisites**
```bash
node --version    # v18+
npm --version     # v8+
mysql --version   # v8.0+
```

### **1. Start Backend**
```bash
cd backend
npm install
npm start          # Listens on http://localhost:5000
```

*Expected output:* `Server running on port 5000`  
*Verify:* `curl http://localhost:5000/api/sensors` → should return JSON

### **2. Start Frontend**
```bash
cd frontend
npm install
npm run dev        # Listens on http://localhost:5173
```

*Expected output:* `VITE v5.0.0 ready in 123 ms`  
*Verify:* Open http://localhost:5173 in browser

### **3. Setup Database** *(One-time)*
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE aquaculture_db;"

# Import schema
mysql -u root -p aquaculture_db < backend/DATABASE_SCHEMA.sql

# Verify
mysql -u root -p aquaculture_db -e "SHOW TABLES;"
```

**✅ All three services running!** Dashboard should display zones and sensors.

---

## 📋 Team Structure & Tasks (5 People)

### **Person 1: Database Admin**
**Role:** MySQL setup, schema management, data migration  
**Deliverables:**
- [ ] MySQL installed + running
- [ ] Database created: `aquaculture_db`
- [ ] Schema imported: `DATABASE_SCHEMA.sql`
- [ ] Test data verified (3 zones, 20 ponds, 4 sensors, 4 users)
- [ ] Create `backend/services/db.js` (connection pool)

**Reference:** [backend/DATABASE_SCHEMA.sql](backend/DATABASE_SCHEMA.sql)

### **Person 2: Backend API (Sensors Module)**
**Role:** Implement sensor endpoints, replace mock data with real DB queries  
**Deliverables:**
- [ ] GET `/api/sensors` - list all sensors
- [ ] GET `/api/sensors/:sensorId/latest` - latest reading
- [ ] GET `/api/sensors/:sensorId/history` - 24h history
- [ ] Tests remain GREEN (`npm run test:once`)
- [ ] Error handling for DB failures

**Reference:** [backend/API_ENDPOINTS.md](backend/API_ENDPOINTS.md#module-1-sensors)  
**Start:** `backend/routes/sensors.js` (mock skeleton ready)

### **Person 3: Backend API (Zones/Ponds/Alerts)**
**Role:** Implement remaining core endpoints  
**Deliverables:**
- [ ] GET `/api/zones` - list zones
- [ ] GET `/api/zones/:zoneId/ponds` - list ponds in zone
- [ ] GET `/api/ponds/:pondCode/farming-cycle` - cycle info
- [ ] GET `/api/dashboard/status` - summary KPIs
- [ ] GET `/api/alerts` (Module 2) - active alerts
- [ ] Tests remain GREEN

**Reference:** [backend/API_ENDPOINTS.md](backend/API_ENDPOINTS.md)

### **Person 4: Frontend Dashboard**
**Role:** Build React components, integrate with API  
**Deliverables:**
- [ ] Sidebar component (zone/pond selector)
- [ ] SensorCard component (MVP priority)
- [ ] SensorChart (Recharts line chart)
- [ ] Dashboard page (layout + integration)
- [ ] Real-time polling (`useReadings` hook)
- [ ] Responsive design (mobile + desktop)

**Reference:** [frontend/FRONTEND_STRUCTURE.md](frontend/FRONTEND_STRUCTURE.md)  
**Start:** `frontend/src/components/` (use examples in README)

### **Person 5: Integration & QA**
**Role:** End-to-end testing, bug fixes, video demo  
**Deliverables:**
- [ ] Run MVP checklist (see below)
- [ ] Test all 7 core endpoints
- [ ] Verify real-time data updates (5s polling)
- [ ] Check responsive design
- [ ] Record demo video for 23/03
- [ ] Prepare presentation slides

**Reference:** MVP Checklist section below

---

## 📅 Critical Timeline

| Phase | Dates | Module | Deadline | Deliverable |
|-------|-------|--------|----------|-------------|
| **MVP Sprint** | 19-23 Mar | Module 1 | **23 Mar** | Sensor dashboard |
| **Extended** | 24-27 Mar | Module 2 | 27 Mar | Alerts + logs |
| **Features** | 28 Mar-20 Apr | Module 3-5 | 20 Apr | Full system |

### **23 March Demo (Module 1 - MVP)**
✅ Must-have:
- Zones list (GET /api/zones)
- Ponds by zone (GET /api/zones/:id/ponds)
- Latest sensor readings (GET /api/sensors/:id/latest)
- 24h sensor history (GET /api/sensors/:id/history)
- Dashboard with live cards + charts

🟡 Nice-to-have:
- System status KPIs
- Alert notifications
- Device control UI

---

## ✅ MVP Checklist (Before 23 Mar Demo)

### **Backend**
- [ ] 7 core endpoints implemented
- [ ] `npm run test:once` - all tests PASSING ✅
- [ ] Database queries replace mock data
- [ ] Error handling working (404, 500)
- [ ] API response format consistent {success, data, timestamp}
- [ ] CORS enabled for frontend

### **Frontend**
- [ ] Dependencies installed: `npm install`
- [ ] `npm run dev` starts without errors
- [ ] Sidebar loads zones from API
- [ ] Selecting zone loads ponds
- [ ] SensorCard displays latest readings
- [ ] Charts show 24h history
- [ ] Real-time polling (data updates every 5 seconds)
- [ ] Responsive design (works on mobile + desktop)
- [ ] No errors in browser console (F12)

### **Database**
- [ ] MySQL running locally
- [ ] Database `aquaculture_db` created
- [ ] All 15 tables created (verify: `SHOW TABLES;`)
- [ ] Test data inserted (3 zones, 20 ponds, 4 sensors)
- [ ] Connection pool working in Node.js

### **Integration**
- [ ] Backend + Frontend communicate successfully
- [ ] Real-time sensor data displays in dashboard
- [ ] Charts update every 5 seconds with new data
- [ ] No API errors in Network tab (F12)
- [ ] All 7 endpoints tested with Postman/curl

### **Demo**
- [ ] Video recorded (2-3 minutes)
- [ ] Shows zones → ponds → sensor data
- [ ] Demonstrates real-time updates
- [ ] Submitted to LMS before deadline

---

## 📁 File Location Guide

### **Backend Setup Files**
- 📄 [backend/package.json](backend/package.json) - Dependencies + npm scripts
- 🔧 [backend/server.js](backend/server.js) - Express app + routes
- 🗄️ [backend/services/db.js](backend/services/db.js) - MySQL pool (Person 1 creates)
- 🔌 [backend/routes/sensors.js](backend/routes/sensors.js) - Sensor endpoints (Person 2 completes)

### **Documentation**
- 📋 [backend/DATABASE_SCHEMA.sql](backend/DATABASE_SCHEMA.sql) - Complete DB schema (15 tables)
- 📖 [backend/API_ENDPOINTS.md](backend/API_ENDPOINTS.md) - All 22 endpoints with examples
- 📖 [backend/README.md](backend/README.md) - Backend setup guide
- 📖 [backend/TDD_WORKFLOW.md](backend/TDD_WORKFLOW.md) - Development methodology + timeline

### **Frontend Setup Files**
- 📄 [frontend/package.json](frontend/package.json) - React + Vite dependencies
- ⚙️ [frontend/vite.config.js](frontend/vite.config.js) - Vite build config
- 🎨 [frontend/index.html](frontend/index.html) - HTML entry point

### **Frontend Structure**
- 📖 [frontend/FRONTEND_STRUCTURE.md](frontend/FRONTEND_STRUCTURE.md) - Component architecture + code examples
- 📖 [frontend/README.md](frontend/README.md) - Frontend setup guide
- 🗂️ [frontend/src/components/](frontend/src/components/) - React components (create here)
- 🪝 [frontend/src/hooks/](frontend/src/hooks/) - Custom hooks (create here)
- 🔌 [frontend/src/services/](frontend/src/services/) - API services (create here)

---

## 🧪 Testing & Verification

### **Run Backend Tests**
```bash
cd backend
npm run test:once    # Runs Jest test suite
```

Shows test results: 6 tests for sensors module passing ✅

### **Manual API Testing**
```bash
# Terminal (or use Postman app)
curl http://localhost:5000/api/sensors
curl http://localhost:5000/api/sensors/SENSOR_A01_DO/latest
curl http://localhost:5000/api/zones
```

### **Check Real-time Updates**
1. Open browser DevTools (F12)
2. Network tab → XHR filter
3. Should see API requests every 5 seconds
4. SensorCard values should update in real-time

---

## 🐛 Troubleshooting

### **Backend Issues**

**MongoDB/MySQL connection fails?**
```bash
# Check MySQL is running
mysql -u root -p -e "SELECT 1;"

# Verify database exists
mysql -u root -p -e "SHOW DATABASES;" | grep aquaculture
```

**Tests failing?**
```bash
cd backend
npm run test:once      # Run with verbose output
```

**Port 5000 in use?**
```bash
lsof -i :5000          # Find process
kill -9 <PID>          # Kill it
npm start              # Restart
```

### **Frontend Issues**

**Page blank or loading forever?**
```bash
# Check console (F12 → Console tab)
# Look for errors about API base URL

# Verify backend is running:
curl http://localhost:5000
```

**Port 5173 in use?**
```bash
npm run dev -- --port 5174
```

---

## 📚 Key Resources

### **Documentation**
- [TDD Workflow Guide](backend/TDD_WORKFLOW.md) - How to test-first code
- [API Specification](backend/API_ENDPOINTS.md) - Exact endpoint formats
- [Database Schema](backend/DATABASE_SCHEMA.sql) - Table structures & relationships

### **Getting Started**
- [Backend Setup](backend/README.md) - Node.js + MySQL quick start
- [Frontend Setup](frontend/README.md) - React + Vite quick start
- [Component Guide](frontend/FRONTEND_STRUCTURE.md) - React component examples

### **External Links**
- [Node.js Docs](https://nodejs.org/docs/)
- [Express Guide](https://expressjs.com)
- [React Docs](https://react.dev)
- [MySQL Manual](https://dev.mysql.com/doc)
- [Recharts Docs](https://recharts.org)

---

## 👥 Contact & Support

**Tech Lead:** [Your Name]  
**Backend Contact:** Person 2-3  
**Frontend Contact:** Person 4  
**Database Contact:** Person 1  
**QA Contact:** Person 5  

---

## 📊 Project Status

| Component | Status | Progress |
|-----------|--------|----------|
| 📋 Requirements | ✅ Done | 100% |
| 📐 Design | ✅ Done | 100% |
| 🎨 Frontend Architecture | ✅ Done | Components designed |
| 👨‍💻 Implementation | 🔄 In Progress | Day 1-3 of sprint |
| ✔️ Testing | 🔄 In Progress | Team testing |
| 🎬 Demo | ⏳ Pending | Due 23 Mar |

---

*Last updated: March 2026*
