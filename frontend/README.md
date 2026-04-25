# Frontend Guide - Aquaculture

Tai lieu nay chi tap trung cho module frontend trong thu muc frontend.

## 1. Module nay lam gi

Frontend la dashboard React de:
- Dang nhap, quan ly session nguoi dung
- Hien thi dashboard, logs, reports
- Quan ly khu vuc, ao nuoi, thiet bi theo role
- Goi API backend tai http://localhost:5000/api

App chay mac dinh tai:
- http://localhost:5173

## 2. Cau truc quan trong

```
frontend/
|- src/
|  |- main.jsx                  # React entry
|  |- App.jsx                   # Router + protected routes
|  |- context/AuthContext.jsx   # Auth state
|  |- services/api.js           # API calls
|  |- pages/                    # Man hinh chinh
|  |- components/               # UI components
|  |- hooks/                    # Custom hooks
|  |- styles/
|- public/
|- index.html
|- vite.config.js
|- eslint.config.js
```

## 3. Yeu cau

- Node.js 18+
- npm 8+
- Backend dang chay tai cong 5000

Kiem tra nhanh:

```bash
node --version
npm --version
```

## 4. Cai dat va chay

```bash
cd frontend
npm install
npm run dev
```

Script co san:
- npm run dev: chay Vite dev server
- npm run build: build production
- npm run preview: xem ban build local
- npm run lint: lint code

## 5. Thu tu doc code de onboard nhanh

1. src/main.jsx
2. src/App.jsx
3. src/context/AuthContext.jsx
4. src/services/api.js
5. src/pages/DashboardPage.jsx
6. src/components/Layout/MainLayout.jsx

## 6. Luong xu ly frontend

1. main.jsx render App
2. App.jsx setup router + ProtectedRoute + RoleRoute
3. AuthContext quan ly token va user info
4. services/api.js goi backend endpoint /api/*
5. page/component render du lieu tu API

## 7. Luu y API va auth

- Token duoc luu trong localStorage voi key aq_token
- services/api.js tu dong gan Authorization header neu co token
- Neu backend chua chay hoac sai host, giao dien se loi fetch/API

## 8. Verify nhanh

Sau khi chay npm run dev:
- Mo http://localhost:5173
- Dang nhap tai khoan co san trong database
- Kiem tra dashboard co du lieu

## 9. Loi thuong gap

### Trang trang hoac quay loading
- Kiem tra console browser
- Kiem tra backend dang chay cong 5000
- Kiem tra URL API trong src/services/api.js

### Port 5173 bi trung

```bash
npm run dev -- --port 5174
```

### Loi dependency

```bash
rm -rf node_modules package-lock.json
npm install
```

Neu ban dang dung Windows PowerShell, co the xoa tay thu muc node_modules neu lenh rm -rf khong hoat dong.

## 10. Tai lieu lien quan

- Root guide: ../README.md
- Frontend structure detail: ./FRONTEND_STRUCTURE.md
- Backend guide: ../backend/README.md