# 🎨 Aquaculture Management System - Frontend Dashboard

**Hệ thống Quản lý và Vận hành Thủy sản Thông minh - React Dashboard**

---

## 📋 TABLE OF CONTENTS
1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Project](#running-the-project)
6. [Component Architecture](#component-architecture)
7. [API Integration](#api-integration)
8. [Real-time Updates](#real-time-updates)
9. [Styling & Themes](#styling--themes)
10. [Build & Deployment](#build--deployment)
11. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

**Prerequisites:**
- Node.js 18+
- Backend API running on http://localhost:5000

**3-minute setup:**
```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Start development server
npm run dev

# 3. Open browser
# Navigate to: http://localhost:5173
```

Dashboard should load with live sensor data!

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.jsx         # Zone & pond selector
│   │   │   ├── Header.jsx          # Top navigation + user menu
│   │   │   └── MainLayout.jsx      # Main layout wrapper
│   │   │
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.jsx       # Main dashboard page
│   │   │   ├── StatusCard.jsx      # System summary statistics
│   │   │   ├── AlertWidget.jsx     # Active alerts display
│   │   │   └── QuickStats.jsx      # KPIs widget
│   │   │
│   │   ├── Sensors/
│   │   │   ├── SensorGrid.jsx      # Grid of all sensors
│   │   │   ├── SensorCard.jsx      # Individual sensor card (MVIP)
│   │   │   ├── SensorChart.jsx     # Recharts line chart
│   │   │   ├── SensorThreshold.jsx # Threshold visualization
│   │   │   └── SensorHistory.jsx   # 30-day history modal
│   │   │
│   │   ├── Ponds/
│   │   │   ├── PondList.jsx        # List of ponds
│   │   │   ├── PondCard.jsx        # Pond summary card
│   │   │   ├── PondDetail.jsx      # Detailed pond info (right sidebar)
│   │   │   └── EdgeStationStatus.jsx # Edge device connectivity
│   │   │
│   │   ├── Alerts/
│   │   │   ├── AlertsPanel.jsx     # Active alerts list
│   │   │   ├── AlertItem.jsx       # Individual alert row
│   │   │   └── AlertModal.jsx      # Acknowledge dialog
│   │   │
│   │   └── Common/
│   │       ├── LoadingSpinner.jsx  # Loading indicator
│   │       ├── ErrorBoundary.jsx   # Error handling
│   │       └── Toast.jsx           # Notifications
│   │
│   ├── hooks/
│   │   ├── useZones.js             # Fetch zones (GET /api/zones)
│   │   ├── usePonds.js             # Fetch ponds (GET /api/zones/:id/ponds)
│   │   ├── useSensors.js           # Fetch sensors
│   │   ├── useReadings.js          # Polling for sensor readings (REALTIME)
│   │   ├── useAlerts.js            # Fetch alerts
│   │   └── useDashboard.js         # Fetch dashboard summary
│   │
│   ├── services/
│   │   ├── api.js                  # Axios instance + config
│   │   ├── zoneService.js          # Zone API calls
│   │   ├── pondService.js          # Pond API calls
│   │   ├── sensorService.js        # Sensor API calls
│   │   ├── alertService.js         # Alert API calls
│   │   └── deviceService.js        # Device control APIs
│   │
│   ├── context/
│   │   ├── SelectedZoneContext.js  # Track selected zone state
│   │   ├── SelectedPondContext.js  # Track selected pond state
│   │   └── AuthContext.js          # User auth (future)
│   │
│   ├── pages/
│   │   ├── DashboardPage.jsx       # Main dashboard page
│   │   ├── AlertsPage.jsx          # Full alerts view
│   │   └── ReportsPage.jsx         # Reports & export (HTTT)
│   │
│   ├── styles/
│   │   ├── Dashboard.css           # Dashboard styles
│   │   ├── Sensors.css             # Sensor component styles
│   │   ├── Responsive.css          # Mobile breakpoints
│   │   ├── theme.css               # Color scheme + variables
│   │   └── index.css               # Global styles
│   │
│   ├── utils/
│   │   ├── formatters.js           # Date/number formatting
│   │   ├── thresholdHelpers.js     # Threshold color logic
│   │   └── constants.js            # API endpoints, sensor types
│   │
│   ├── App.jsx                     # Root component
│   ├── main.jsx                    # Vite entry point
│   └── index.css                   # Bootstrap styles
│
├── public/
│   └── favicon.ico
│
├── package.json                    # Dependencies + scripts
├── vite.config.js                  # Vite configuration
├── .env.example                    # Environment template
├── index.html                      # HTML entry point
├── FRONTEND_STRUCTURE.md           # Component architecture detail
└── README.md                       # This file
```

---

## 📦 Installation

### **1. Prerequisites**
```bash
node --version    # Should be v18+
npm --version     # Should be v8+
```

### **2. Install Dependencies**
```bash
cd frontend
npm install
```

Installs:
- **react** - UI library
- **react-dom** - DOM binding
- **vite** - Build tool (fast!)
- **recharts** - Charting library
- **axios** - HTTP client
- **react-hot-toast** - Notifications

### **3. Verify Installation**
```bash
npm list react
npm list recharts
```

---

## ⚙️ Configuration

### **Create .env file:**
```bash
cp .env.example .env
```

### **Edit .env:**
```env
# Backend API
VITE_API_BASE_URL=http://localhost:5000
VITE_API_TIMEOUT=10000

# App Config
VITE_SENSOR_POLL_INTERVAL=5000  # ms - how often to fetch sensor data
VITE_CHART_DATA_POINTS=144      # Show 24h history (144 x 10min)

# Features
VITE_ENABLE_REAL_TIME=true
VITE_ENABLE_ALERTS=true
VITE_ENABLE_REPORTS=false       # HTTT feature (later)
```

---

## 🏃 Running the Project

### **Development Mode (Vite Hot Reload)**
```bash
npm run dev
```

Output:
```
  VITE v5.0.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Open http://localhost:5173 in browser → **hot reload on file save!**

### **Build for Production**
```bash
npm run build  # Creates dist/ folder
npm run preview # Serve built version
```

### **Check Syntax & Formatting**
```bash
npm run lint  # (if ESLint configured)
```

---

## 🎯 Component Architecture

### **Data Flow:**
```
┌─────────────────────────────────────────────────┐
│                React Component                  │
├─────────────────────────────────────────────────┤
│  1. Component mounts                           │
│     ↓                                           │
│  2. Custom Hook (useReadings, useSensors)     │
│     ↓                                           │
│  3. API Service Layer (sensorService.js)      │
│     ↓                                           │
│  4. Axios Instance + HTTP Request             │
│     ↓                                           │
│  5. Backend API (http://localhost:5000)       │
│     ↓                                           │
│  6. Response → State → Component Re-render    │
│                                                 │
│  Real-time: setInterval in useReadings()      │
│  Default: Every 5 seconds (VITE_SENSOR_POLL_INTERVAL)
└─────────────────────────────────────────────────┘
```

### **Module 1: Core Components (MVP - 23/03)**

#### **1. Sidebar.jsx**
Selects zone → displays ponds in that zone

```jsx
import { useZones } from '../hooks/useZones';
import { usePonds } from '../hooks/usePonds';

export default function Sidebar() {
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const { zones, loading } = useZones();           // GET /api/zones
  const { ponds } = usePonds(selectedZoneId);      // GET /api/zones/:id/ponds

  return (
    <aside className="sidebar">
      {zones?.map(zone => (
        <button key={zone.id} onClick={() => setSelectedZoneId(zone.id)}>
          {zone.zoneCode} - {zone.zoneName}
        </button>
      ))}
    </aside>
  );
}
```

#### **2. SensorCard.jsx** ⭐ **MVP PRIORITY**
Displays one sensor's latest reading + mini chart

```jsx
import { useReadings } from '../hooks/useReadings';

export default function SensorCard({ sensor }) {
  const { latestReading, loading } = useReadings(
    sensor.sensorId, 
    5000  // Poll every 5 seconds
  );

  return (
    <div className={`sensor-card status-${latestReading?.status}`}>
      <h4>{sensor.sensorName}</h4>
      <div className="value-display">
        <span className="number">{latestReading?.value?.toFixed(2)}</span>
        <span className="unit">{sensor.unit}</span>
      </div>
      <p className="last-update">Last: {latestReading?.timestamp}</p>
    </div>
  );
}
```

#### **3. SensorChart.jsx**
Real-time line chart with Recharts

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

export default function SensorChart({ data, threshold }) {
  return (
    <LineChart width={500} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="timestamp" />
      <YAxis />
      <Tooltip />
      
      {/* Threshold reference lines */}
      <ReferenceLine y={threshold.maxNormal} stroke="orange" label="Max" />
      <ReferenceLine y={threshold.minNormal} stroke="orange" label="Min" />
      
      <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} />
    </LineChart>
  );
}
```

#### **4. Dashboard.jsx**
Main page - combines all components

```jsx
export default function Dashboard() {
  return (
    <MainLayout>
      <Sidebar onChange={setSelectedPond} />
      
      <main className="dashboard">
        <StatusCard />
        <AlertWidget />
        <SensorGrid pondId={selectedPondId} />
      </main>
    </MainLayout>
  );
}
```

---

## 🔌 API Integration

### **Services (API Layer)**

**services/api.js** - Axios configuration:
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export default api;
```

**services/sensorService.js** - Sensor API calls:
```javascript
import api from './api';

export const sensorService = {
  getLatestReading: (sensorId) =>
    api.get(`/api/sensors/${sensorId}/latest`),
  
  getHistory: (sensorId, days = 1) =>
    api.get(`/api/sensors/${sensorId}/history`, {
      params: { startDate: /* 24h ago */ }
    })
};
```

### **Custom Hooks (Data Fetching)**

**hooks/useReadings.js** - Polling for real-time sensor data:
```javascript
import { useState, useEffect } from 'react';
import { sensorService } from '../services/sensorService';

export function useReadings(sensorId, pollInterval = 5000) {
  const [latestReading, setLatestReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReading = async () => {
      try {
        const response = await sensorService.getLatestReading(sensorId);
        setLatestReading(response.data.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchReading();  // Initial fetch
    
    // Poll every N seconds
    const interval = setInterval(fetchReading, pollInterval);
    
    return () => clearInterval(interval);  // Cleanup
  }, [sensorId, pollInterval]);

  return { latestReading, loading, error };
}
```

**Use in component:**
```javascript
const { latestReading, loading, error } = useReadings('SENSOR_A01_DO');

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage msg={error} />;

return <div>{latestReading.value} {latestReading.unit}</div>;
```

---

## ⚡ Real-time Updates

### **Strategy: Polling (Simple & Works)**

Current approach: Poll API every 5 seconds
```javascript
const pollInterval = 5000  // 5 seconds
const [readings, setReadings] = useState([]);

useEffect(() => {
  const interval = setInterval(() => {
    // Fetch latest sensor readings
    api.get('/api/sensors').then(res => setReadings(res.data.data));
  }, pollInterval);
  
  return () => clearInterval(interval);
}, []);
```

**Pros:** Simple, reliable, works without WebSocket  
**Cons:** Slight delay, more API load

**Future: WebSocket (Real-time)**
```javascript
// TODO: Switch to WebSocket when backend ready
const ws = new WebSocket('ws://localhost:5000/api/sensors/live');
ws.onmessage = (event) => {
  const sensorData = JSON.parse(event.data);
  setReadings(prev => [...prev, sensorData]);
};
```

---

## 🎨 Styling & Themes

### **CSS Variables (Color Scheme)**

```css
/* styles/theme.css */
:root {
  /* Sensor Status Colors */
  --status-normal: #4caf50;      /* Green */
  --status-warning: #ff9800;     /* Orange */
  --status-critical: #f44336;    /* Red */
  --status-offline: #757575;     /* Grey */
  
  /* UI Colors */
  --primary: #1976d2;
  --secondary: #03a9f4;
  --background: #f5f5f5;
  --surface: #ffffff;
  --border: #e0e0e0;
}
```

### **Component Styling**

**SensorCard with status colors:**
```css
.sensor-card {
  border-left: 4px solid;
  padding: 16px;
  border-radius: 8px;
}

.sensor-card.status-normal {
  border-left-color: var(--status-normal);
  background-color: rgba(76, 175, 80, 0.1);
}

.sensor-card.status-warning {
  border-left-color: var(--status-warning);
  background-color: rgba(255, 152, 0, 0.1);
}

.sensor-card.status-critical {
  border-left-color: var(--status-critical);
  background-color: rgba(244, 67, 54, 0.1);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

### **Responsive Design**

```css
/* Mobile first */
.dashboard {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .dashboard {
    grid-template-columns: 250px 1fr;  /* Sidebar + main */
  }
}

/* Desktop */
@media (min-width: 1280px) {
  .dashboard {
    grid-template-columns: 250px 1fr 350px;  /* Sidebar + main + detail panel */
  }
}
```

---

## 🏗️ Build & Deployment

### **Development Build**
```bash
npm run dev
# Hot reload enabled - changes appear instantly
```

### **Production Build**
```bash
npm run build
# Creates optimized dist/ folder
```

### **Preview Built Version**
```bash
npm run preview
# Simulates production locally
```

### **Deploy to Server**

```bash
# 1. Build
npm run build

# 2. Upload dist/ folder to server
# e.g., to nginx:
scp -r dist/* user@server:/var/www/aquaculture/

# 3. Configure nginx to serve index.html for SPA routing
# (needed for React Router)
```

---

## 🧪 Testing (Optional for MVP)

```bash
npm install --save-dev @testing-library/react vitest
```

**Example test:**
```javascript
import { render, screen } from '@testing-library/react';
import SensorCard from '../SensorCard';

test('displays sensor value', () => {
  const sensor = { sensorId: 'TEST', sensorName: 'Test' };
  render(<SensorCard sensor={sensor} />);
  
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

---

## 🐛 Troubleshooting

### **Q: Page not loading / blank screen?**
```bash
# A: Check console errors (F12)
# A: Verify backend is running: curl http://localhost:5000
# A: Check .env file - VITE_API_BASE_URL must be correct
```

### **Q: Sensor data not updating?**
```javascript
// A: Check useReadings hook polling:
const { latestReading } = useReadings(sensorId, 5000);  // 5 sec interval

// A: Check Network tab (F12) - should see API requests every 5s
```

### **Q: Charts not displaying?**
```bash
# A: npm install recharts
# A: Check Recharts version compatibility
npm list recharts
```

### **Q: Port 5173 already in use?**
```bash
# A: Use different port:
npm run dev -- --port 5174

# A: Or kill process using port:
lsof -i :5173
kill -9 <PID>
```

### **Q: Backend API returns 404?**
```bash
# A: Verify backend is running:
curl http://localhost:5000/api/sensors

# A: Check API endpoint in FRONTEND_STRUCTURE.md matches backend API_ENDPOINTS.md
```

---

## 📋 MVP Checklist (23/03)

- [ ] Dependencies installed: `npm install`
- [ ] Backend running: `npm run dev` at backend/
- [ ] Frontend running: `npm run dev` at frontend/
- [ ] Sidebar loads zones: GET /api/zones ✅
- [ ] Selecting zone loads ponds: GET /api/zones/:id/ponds ✅
- [ ] SensorCard displays latest reading: GET /api/sensors/:id/latest ✅
- [ ] Charts show 24h history: GET /api/sensors/:id/history ✅
- [ ] Real-time polling works (data updates every 5 seconds)
- [ ] Responsive on mobile + desktop
- [ ] No errors in console (F12)

---

## 🚀 Development Workflow

1. **Start both servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm start
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Edit component (auto-reload):**
   Edit `SensorCard.jsx` → Browser refreshes automatically

3. **Test changes:**
   Open http://localhost:5173 → See live updates

4. **Check backend (if API changes):**
   `npm run test:once` (backend tests should still pass)

---

## 📞 FAQ

**Q: How do I add a new component?**
A: Create file in `src/components/`, follow naming from existing components

**Q: How to change polling interval?**
A: Edit `.env` → `VITE_SENSOR_POLL_INTERVAL=10000` (milliseconds)

**Q: How to add WebSocket support?**
A: Refactor `useReadings.js` to use `new WebSocket()` instead of polling

**Q: Where's user authentication?**
A: TODO - add JWT in `AuthContext.js` + API service interceptor

---

## 📚 Resources

- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Recharts Examples](https://recharts.org/examples)
- [Axios Docs](https://axios-http.com)

---

## ✅ Must Completed Features (MVP) - Before 29/03

- ✅ Zone selector (Sidebar)
- ✅ Pond list display
- ✅ Sensor cards with live data
- ✅ Real-time polling (5s interval)
- ✅ Mini charts (24h history)
- ✅ Status color coding (normal/warning/critical)
- ✅ Responsive layout
- ✅ Error handling

## 🔄 Coming Soon (Module 2-5)

- 🔄 Alert notifications
- 🔄 Device control interface
- 🔄 Activity logs
- 🔄 Advanced reporting (HTTT focus)
- 🔄 User authentication

---
## 📝 License

Multidisciplinary Project - Faculty of Computer Science and Engineering, HCMUT - Semester 252
