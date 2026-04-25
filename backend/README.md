# Backend Guide - Aquaculture

Tai lieu nay chi tap trung cho module backend trong thu muc backend.

## 1. Module nay lam gi

Backend la REST API server cho he thong quan ly ao nuoi:
- Xac thuc nguoi dung va phan quyen theo role
- Quan ly khu vuc, ao nuoi, tram, thiet bi
- Nhan du lieu cam bien tu gateway va luu MySQL
- Cung cap du lieu dashboard, alerts, logs cho frontend

Server chay mac dinh tai:
- http://localhost:5000

## 2. Cau truc quan trong

```
backend/
|- server.js               # Entry point, map route /api/*
|- services/db.js          # MySQL connection pool
|- middlewares/            # Auth + RBAC
|  |- auth.js
|  |- rbac.js
|- routes/                 # API modules
|  |- auth.js
|  |- sensors.js
|  |- dashboard.js
|  |- logs.js
|  |- alerts.js
|  |- ponds.js
|  |- users.js
|  |- zones.js
|  |- devices.js
|- routes/__tests__/       # Jest tests
|  |- sensors.test.js
|- env_template.md         # Mau bien moi truong
|- newdb.sql               # SQL dump du lieu lon
```

## 3. Yeu cau

- Node.js 18+
- npm 8+
- MySQL 8+

Kiem tra nhanh:

```bash
node --version
npm --version
mysql --version
```

## 4. Setup backend tu dau

### B1) Chuan bi database

Tu root project, import SQL:

```bash
mysql -u root -p < create_database.sql
```

Neu can bo du lieu day du hon:

```bash
mysql -u root -p < backend/newdb.sql
```

### B2) Tao file .env trong backend

Noi dung goi y:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=ql_ao_nuoi
PORT=5000
TOKEN=your_secret_key
```

Luu y quan trong:
- Code dang doc DB_PASS, khong phai DB_PASSWORD
- DB_NAME phai trung voi schema ban da import

### B3) Cai package va chay server

```bash
cd backend
npm install
npm start
```

Script co san:
- npm start: chay server bang node
- npm run dev: chay server bang nodemon
- npm test: jest watch mode
- npm run test:once: chay test 1 lan

## 5. Verify nhanh

```bash
curl http://localhost:5000/
curl http://localhost:5000/api/sensors/latest
```

Neu server ok, endpoint dau tien tra message API dang chay.

## 6. Flow xu ly backend

1. server.js khoi tao Express + CORS + JSON middleware
2. server.js map route vao /api/*
3. moi route goi services/db.js de query MySQL
4. auth/rbac middleware bao ve endpoint can dang nhap, can role

Route chinh dang dung:
- /api/auth
- /api/sensors
- /api/dashboard
- /api/logs
- /api/alerts
- /api/ponds
- /api/users
- /api/zones
- /api/devices

## 7. Thu tu doc code de onboard nhanh

1. server.js
2. services/db.js
3. middlewares/rbac.js
4. routes/auth.js
5. routes/sensors.js
6. routes/ponds.js
7. routes/devices.js

## 8. Test

```bash
cd backend
npm run test:once
```

Test hien tai nam trong routes/__tests__/sensors.test.js.

## 9. Loi thuong gap

### Khong ket noi duoc DB
- Kiem tra MySQL da chay
- Kiem tra lai DB_NAME, DB_USER, DB_PASS trong .env
- Kiem tra schema da import

### Frontend bao loi API
- Kiem tra backend dang chay cong 5000
- Kiem tra CORS va URL API ben frontend

### Port 5000 bi trung
- Doi PORT trong .env
- Restart backend

## 10. Tai lieu lien quan

- Root guide: ../README.md
- Frontend guide: ../frontend/README.md
- Frontend structure: ../frontend/FRONTEND_STRUCTURE.md
