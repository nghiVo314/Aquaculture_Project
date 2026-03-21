## 🎨 FRONTEND STRUCTURE & COMPONENTS
### Aquaculture Management System - React/Vite Dashboard

**Owner:** Person 4 (Frontend Developer)  
**Framework:** React + Vite + Recharts  
**Priority:** Start once API endpoints are ready

---

## 📁 FOLDER STRUCTURE

```
frontend/src/
├── components/
│   ├── Layout/
│   │   ├── Sidebar.jsx          - Zone & pond navigation
│   │   ├── Header.jsx           - Top bar + user menu
│   │   └── MainLayout.jsx       - Overall layout wrapper
│   │
│   ├── Dashboard/
│   │   ├── Dashboard.jsx        - Main dashboard page
│   │   ├── StatusCard.jsx       - Summary card (zones, ponds, alerts)
│   │   ├── AlertWidget.jsx      - Active alerts bubble
│   │   └── QuickStats.jsx       - KPIs (online edges, sensor count)
│   │
│   ├── Sensors/
│   │   ├── SensorGrid.jsx       - Grid of all sensors
│   │   ├── SensorCard.jsx       - Individual sensor card
│   │   ├── SensorChart.jsx      - Recharts line chart (24h history)
│   │   ├── SensorThreshold.jsx  - Visual threshold display (normal/warning/critical)
│   │   └── SensorHistory.jsx    - Full 30-day history modal
│   │
│   ├── Ponds/
│   │   ├── PondList.jsx         - List of ponds in selected zone
│   │   ├── PondCard.jsx         - Pond summary card
│   │   ├── PondDetail.jsx       - Detailed pond panel (right sidebar)
│   │   └── EdgeStationStatus.jsx - Edge device status + connectivity
│   │
│   ├── Alerts/
│   │   ├── AlertsPanel.jsx      - List of active alerts
│   │   ├── AlertItem.jsx        - Individual alert row
│   │   └── AlertAcknowledgeModal.jsx - Acknowledge dialog
│   │
│   └── Common/
│       ├── LoadingSpinner.jsx
│       ├── ErrorBoundary.jsx
│       └── Toast.jsx            - Notifications
│
├── hooks/
│   ├── useZones.js              - Fetch zones data
│   ├── usePonds.js              - Fetch ponds for zone
│   ├── useSensors.js            - Fetch sensors for pond
│   ├── useReadings.js           - Fetch sensor readings (real-time polling)
│   ├── useAlerts.js             - Fetch active alerts
│   └── useDashboard.js          - Fetch dashboard summary
│
├── services/
│   ├── api.js                   - Axios instance + base config
│   ├── zoneService.js           - Zone API calls
│   ├── pondService.js           - Pond API calls
│   ├── sensorService.js         - Sensor API calls
│   ├── alertService.js          - Alert API calls
│   └── deviceService.js         - Device control API calls (later)
│
├── context/
│   ├── AuthContext.js           - User auth (not MVP)
│   ├── SelectedZoneContext.js   - Track selected zone
│   └── SelectedPondContext.js   - Track selected pond
│
├── pages/
│   ├── DashboardPage.jsx        - Main dashboard
│   ├── AlertsPage.jsx           - Full alerts view (later)
│   └── ReportsPage.jsx          - Reports & export (HTTT focus, later)
│
├── styles/
│   ├── Dashboard.css
│   ├── Sensors.css
│   ├── Responsive.css           - Mobile optimization
│   └── theme.css                - Color scheme, thresholds colors
│
├── utils/
│   ├── formatters.js            - Date, number, sensor value formatting
│   ├── thresholdHelpers.js      - Color status based on thresholds
│   └── constants.js             - API endpoints, sensor types, etc
│
└── App.jsx
```

---

## 🎯 MODULE 1 MVP COMPONENTS (23/03)

### **Layout Components**

**1. Sidebar.jsx**
```jsx
import { useState } from 'react';
import { useZones } from '../hooks/useZones';
import { usePonds } from '../hooks/usePonds';

export default function Sidebar() {
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const { zones, loading: zonesLoading } = useZones();
  const { ponds, loading: pondsLoading } = usePonds(selectedZoneId);

  return (
    <aside className="sidebar">
      <div className="zone-selector">
        <h3>Zones</h3>
        {zones?.map(zone => (
          <button 
            key={zone.id}
            onClick={() => setSelectedZoneId(zone.id)}
            className={selectedZoneId === zone.id ? 'active' : ''}
          >
            {zone.zoneCode} - {zone.zoneName}
          </button>
        ))}
      </div>

      {selectedZoneId && (
        <div className="pond-list">
          <h3>Ponds</h3>
          {ponds?.map(pond => (
            <PondCard key={pond.id} pond={pond} />
          ))}
        </div>
      )}
    </aside>
  );
}
```

**2. SensorCard.jsx**
```jsx
import { useState, useEffect } from 'react';
import { useReadings } from '../hooks/useReadings';
import { SensorChart } from './SensorChart';
import { SensorThreshold } from './SensorThreshold';

export default function SensorCard({ sensor }) {
  const { latestReading } = useReadings(sensor.sensorId);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Fetch 24h history for mini chart
    const fetchHistory = async () => {
      const res = await fetch(
        `/api/sensors/${sensor.sensorId}/history?limit=144`
      );
      const data = await res.json();
      setHistory(data.data);
    };
    fetchHistory();
  }, [sensor.sensorId]);

  return (
    <div className={`sensor-card status-${latestReading?.status}`}>
      <h4>{sensor.sensorName}</h4>
      
      <div className="reading-display">
        <span className="value">{latestReading?.value?.toFixed(2)}</span>
        <span className="unit">{sensor.unit}</span>
      </div>

      <SensorThreshold 
        value={latestReading?.value} 
        threshold={sensor.threshold}
      />

      <div className="mini-chart">
        <SensorChart 
          data={history}
          width="100%" 
          height={150} 
        />
      </div>

      <p className="timestamp">
        Last: {new Date(latestReading?.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}
```

**3. Dashboard.jsx (Main Page)**
```jsx
import { useState } from 'react';
import { Sidebar } from './Layout/Sidebar';
import { StatusCard } from './Dashboard/StatusCard';
import { SensorGrid } from './Sensors/SensorGrid';
import { AlertWidget } from './Alerts/AlertWidget';

export default function Dashboard() {
  const [selectedPondId, setSelectedPondId] = useState(null);

  return (
    <MainLayout>
      <Sidebar onPondSelect={setSelectedPondId} />
      
      <main className="dashboard-main">
        <div className="dashboard-top">
          <StatusCard />
          <AlertWidget />
        </div>

        {selectedPondId && (
          <>
            <h2>Sensors - Pond {selectedPondId}</h2>
            <SensorGrid pondId={selectedPondId} />
          </>
        )}

        <PondDetail pondId={selectedPondId} />
      </main>
    </MainLayout>
  );
}
```

---

## 🧠 Custom Hooks (Real-time Updates)

**hooks/useReadings.js** - Polling for sensor data
```jsx
import { useState, useEffect } from 'react';

export function useReadings(sensorId, pollInterval = 5000) {
  const [latestReading, setLatestReading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/sensors/${sensorId}/latest`);
        const data = await res.json();
        setLatestReading(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, pollInterval);
    return () => clearInterval(interval);
  }, [sensorId, pollInterval]);

  return { latestReading, loading };
}
```

**hooks/usePonds.js** - Fetch ponds for selected zone
```jsx
import { useState, useEffect } from 'react';

export function usePonds(zoneId) {
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!zoneId) return;
    
    const fetch = async () => {
      setLoading(true);
      const res = await fetch(`/api/zones/${zoneId}/ponds`);
      const data = await res.json();
      setPonds(data.data);
      setLoading(false);
    };

    fetch();
  }, [zoneId]);

  return { ponds, loading };
}
```

---

## 📊 HTTT (Visualization) FEATURES

**HTTT Focus Features (for advanced dashboard):**

### **1. Real-time Charts (Recharts)**
```jsx
<LineChart data={sensorHistory}>
  <XAxis dataKey="timestamp" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip />
  <ReferenceLine 
    y={threshold.maxNormal} 
    stroke="orange" 
    label="Normal Max"
  />
  <ReferenceLine 
    y={threshold.minNormal} 
    stroke="orange" 
    label="Normal Min"
  />
  <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} />
</LineChart>
```

### **2. Status Grid with Color Coding**
```css
/* Threshold status colors */
.sensor-card.status-normal { border-left: 4px solid #4caf50; }     /* Green */
.sensor-card.status-warning { border-left: 4px solid #ff9800; }    /* Orange */
.sensor-card.status-critical { border-left: 4px solid #f44336; }   /* Red */
```

### **3. Dashboard Summary KPIs**
```jsx
<StatusCard
  zones={3}
  ponds={20}
  edgeOnline={35}
  edgeOffline={5}
  activeAlerts={2}
/>
```

### **4. Alert Notifications (Real-time)**
```jsx
// Toast notifications for critical alerts
{alertCritical && (
  <Toast 
    type="critical" 
    message={`⚠️ DO Low in ${pondCode}: ${value} mg/L`}
  />
)}
```

---

## 🔄 DATA FLOW

```
┌─────────────────────────────────────────────────────┐
│              React Component                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Component Mounts                               │
│     ↓                                               │
│  2. Custom Hook (useReadings, useSensors, etc)    │
│     ↓                                               │
│  3. API Service Layer (sensorService.js)          │
│     ↓                                               │
│  4. Axios Instance (api.js)                        │
│     ↓                                               │
│  5. Backend API Endpoint                           │
│     ↓                                               │
│  6. Response → State Update → Re-render            │
│                                                     │
│  Real-time updates: setInterval polling (5-10s)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 DEVELOPMENT TASKS

| Task | Component | Dependency | Priority | Effort |
|------|-----------|-----------|----------|--------|
| Setup Vite + dependencies | - | - | 🔴 | 30m |
| Create Sidebar + zone selector | Sidebar | API 1.1 | 🔴 | 1h |
| Create SensorCard + mini chart | SensorCard | API 1.4-1.5 | 🔴 | 1.5h |
| Create Dashboard main page | Dashboard | All above | 🔴 | 1h |
| Add real-time polling hook | useReadings | - | 🔴 | 30m |
| Create PondDetail panel | PondDetail | API 1.6 | 🟡 | 1h |
| StatusCard summary | StatusCard | API 1.7 | 🟡 | 45m |
| AlertWidget notifications | AlertWidget | API 2.1 | 🟡 | 1h |
| Full 30-day chart modal | SensorHistory | API 1.5 | 🟢 | 1h |
| Mobile responsive design | All | - | 🟢 | 2h |

---

## 🧪 FRONTEND TESTING (Optional for MVP)

Install: `npm install --save-dev @testing-library/react`

```jsx
// __tests__/SensorCard.test.jsx
import { render, screen } from '@testing-library/react';
import SensorCard from '../components/Sensors/SensorCard';

test('displays sensor value and unit', () => {
  const sensor = { sensorId: 'TEST', sensorName: 'Test Sensor', unit: 'mg/L' };
  render(<SensorCard sensor={sensor} />);
  expect(screen.getByText('Test Sensor')).toBeInTheDocument();
});
```

---

## 📱 RESPONSIVE DESIGN

```css
/* Mobile first approach */
.dashboard-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 1024px) {
  .dashboard-main {
    grid-template-columns: 1fr 400px;  /* Sidebar + main + detail panel */
  }
}

/* Hide details on mobile, show on desktop */
.pond-detail {
  display: none;
}

@media (min-width: 1280px) {
  .pond-detail {
    display: block;
    width: 400px;
  }
}
```

---

## 🎨 COLOR SCHEME & THEME

```css
/* Sensor Status Colors */
--status-normal: #4caf50     /* Green */
--status-warning: #ff9800    /* Orange */
--status-critical: #f44336   /* Red */
--status-offline: #757575    /* Grey */

/* UI Colors */
--primary: #1976d2
--secondary: #03a9f4
--background: #f5f5f5
--surface: #ffffff
--text-primary: #212121
--text-secondary: #757575
```

---

## ✅ MVIP CHECKLIST

```
□ Sidebar with zone/pond navigation
□ Sensor cards with latest values
□ Mini charts (24h history)
□ Real-time polling (5-10s updates)
□ Dashboard summary card
□ Status colors (normal/warning/critical)
□ Responsive on desktop + mobile
□ Error handling + loading states
□ Accessibility (alt text, labels, etc)
```

---

## 📞 FRONTEND QUESTIONS?

- Feel like data is stale? → Reduce polling interval in useReadings
- Chart looks ugly? → Check Recharts documentation
- API returns unexpected format? → Verify with API_ENDPOINTS.md
- Component too slow? → Add React.memo() for expensive renders

---
