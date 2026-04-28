# Aquaculture Management System (Root Guide)

README nay la tai lieu tong quan cho toan bo workspace (khong chi rieng frontend hoac backend).

Muc tieu:
- Giup ban hieu cau truc thu muc nhanh
- Chay duoc he thong day du (DB + Backend + Frontend, va Gateway neu can)
- Biet file nao quan trong de sua dung cho FE/BE

---

## 1. Tong Quan Kien Truc

```
Frontend (React + Vite)      http://localhost:5173
				|
				| HTTP /api/*
				v
Backend (Node.js + Express)  http://localhost:5000
				|
				v
MySQL Database               (schema ql_ao_nuoi)

Gateway (Python, optional) -> gui du lieu cam bien ve Backend
```

---

## 2. Cau Truc Thu Muc Chinh

```
Aquaculture/
|- backend/              # API server + business logic + DB access
|- frontend/             # React app
|- gateway/              # Python service mo phong/doc du lieu edge device
|- create_database.sql   # SQL khoi tao DB + seed co ban
|- HOW TO RUN.txt        # Huong dan chay nhanh bang tay
|- README.md             # Tai lieu tong quan (file nay)
```

Chi tiet nhanh:
- backend:
	- server.js: Entry point cua Express, map route /api/*
	- routes/: tung module API (auth, sensors, ponds, zones, devices, ...)
	- services/db.js: MySQL pool (mysql2/promise)
	- env_template.md: mau bien moi truong
- frontend:
	- src/App.jsx: Router + protected routes theo role
	- src/services/api.js: ham goi API ve backend
	- src/pages/: cac trang man hinh
	- src/components/: component UI tai su dung
- gateway:
	- main.py: vong lap nhan/sinh du lieu cam bien, dong bo ve backend
	- adafruit_service.py: publish du lieu len Adafruit IO

---

## 3. Yeu Cau Moi Truong

- Node.js 18+
- npm 8+
- MySQL 8+
- Python 3.10+ (neu chay gateway)

Kiem tra nhanh:

```bash
node --version
npm --version
mysql --version
python --version
```

---

## 4. Setup Tu Dau (Dung Thu Tu)

### B1) Tao va nap Database

Luu y: SQL hien tai tao database ten `ql_ao_nuoi`.

```bash
mysql -u root -p < create_database.sql
```

Kiem tra:

```bash
mysql -u root -p -e "SHOW DATABASES LIKE 'ql_ao_nuoi';"
mysql -u root -p -D ql_ao_nuoi -e "SHOW TABLES;"
```

Neu ban muon dung file dump day du lieu lon hon, co the import `backend/newdb.sql` thay vi `create_database.sql`.

### B2) Cau hinh Backend `.env`

Trong thu muc `backend`, tao/chinh file `.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=ql_ao_nuoi
PORT=5000
TOKEN=your_secret_key
```

Luu y:
- Trong code, `services/db.js` doc bien `DB_PASS` (khong phai `DB_PASSWORD`).
- Phai dam bao `DB_NAME` khop voi database ban da import.

### B3) Chay Backend

```bash
cd backend
npm install
npm start
```

Backend se chay tai `http://localhost:5000`.

Test nhanh:

```bash
curl http://localhost:5000/
curl http://localhost:5000/api/sensors/latest
```

### B4) Chay Frontend

Mo terminal moi:

```bash
cd frontend
npm install
npm run dev
```

Frontend se chay tai `http://localhost:5173`.

### B5) Chay Gateway (optional, neu can data realtime)

Mo terminal moi:


co venv da cai san adafruit-io requests pyserial
source .venv/bin/activate
python gateway/main.py

```bash
python gateway/main.py
```

Gateway can Backend dang chay truoc de goi API `/api/ponds/gateway-init` va cac endpoint devices/sensors.

---

## 5. Cach Hieu Backend Nhanh

Luong xu ly chinh:
1. `backend/server.js` khoi tao Express + CORS + JSON body parser.
2. Server map route vao `/api/*`:
	 - `/api/auth`
	 - `/api/sensors`
	 - `/api/dashboard`
	 - `/api/logs`
	 - `/api/alerts`
	 - `/api/ponds`
	 - `/api/users`
	 - `/api/zones`
	 - `/api/devices`
3. Moi route goi `services/db.js` de query MySQL.
4. Auth/RBAC nam o `middlewares/auth.js` va `middlewares/rbac.js`.

File nen doc dau tien (BE):
- `backend/server.js`
- `backend/services/db.js`
- `backend/routes/auth.js`
- `backend/routes/sensors.js`
- `backend/routes/ponds.js`
- `backend/routes/devices.js`

Test backend:

```bash
cd backend
npm run test:once
```

---

## 6. Cach Hieu Frontend Nhanh

Luong xu ly chinh:
1. `frontend/src/main.jsx` render `App`.
2. `frontend/src/App.jsx` dinh nghia routing, protected route, role route.
3. `frontend/src/services/api.js` chua ham fetch API ve backend (`http://localhost:5000/api`).
4. Cac trang trong `frontend/src/pages/` su dung component/hook de hien thi du lieu.

File nen doc dau tien (FE):
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/services/api.js`
- `frontend/src/pages/DashboardPage.jsx`

---

## 7. Chay Toan He Thong (3 terminal)

Terminal 1:

```bash
cd backend
npm start
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Terminal 3 (neu can realtime/gateway):

```bash
python gateway/main.py
```

Sau do mo trinh duyet: `http://localhost:5173`

---

## 8. Troubleshooting Nhanh

### Loi ket noi DB
- Kiem tra MySQL dang chay
- Kiem tra dung ten DB trong `.env` (`DB_NAME=newdb`)
- Kiem tra username/password MySQL

### Frontend khong goi duoc API
- Dam bao backend dang chay cong 5000
- Kiem tra file `frontend/src/services/api.js` dang dung dung host (`http://localhost:5000/api`)

### Port bi trung

```bash
# Doi cong frontend
cd frontend
npm run dev -- --port 5174
```

---

## 9. Tai Lieu Bo Sung Trong Repo

- Backend guide: [backend/README.md](backend/README.md)
- Frontend guide: [frontend/README.md](frontend/README.md)
- Frontend structure: [frontend/FRONTEND_STRUCTURE.md](frontend/FRONTEND_STRUCTURE.md)
- Huong dan chay nhanh cu: [HOW TO RUN.txt](HOW TO RUN.txt)

---

## 10. Note Quan Trong

- Root README nay la tai lieu tong quan cho ca FE + BE + Gateway.
- Tai lieu trong `backend/` va `frontend/` nen duoc xem la chi tiet module.
- Neu doi ten database/schema, hay cap nhat dong bo:
	- file SQL
	- `backend/.env`
	- huong dan trong README
