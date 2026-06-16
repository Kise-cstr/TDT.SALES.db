# Frontend & Backend Connection Setup

## Quick Start

### Backend Setup
1. Navigate to backend directory:
   ```bash
   cd backEnd
   npm install
   ```

2. Verify `.env` file exists with:
   ```
   DATABASE_URL="postgresql://postgres:admin123@localhost:5432/powersteel_db"
   JWT_SECRET=powersteel_secret_key
   ```

3. Run database migrations (if needed):
   ```bash
   npx prisma migrate dev
   ```

4. Start the backend:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000`

### Frontend Setup
1. Navigate to frontend directory:
   ```bash
   cd frontEnd
   npm install
   ```

2. Verify `.env.local` file exists with:
   ```
   REACT_APP_API_BASE_URL=http://localhost:5000/api
   ```

3. Start the frontend:
   ```bash
   npm start
   ```
   The frontend will run on `http://localhost:3000`

## Architecture

### Backend (Node.js + Express + Prisma)
- **Port:** 5000
- **Base URL:** `http://localhost:5000`
- **API Endpoints:**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - Login user
  - `GET /api/dashboard/analytics` - Get dashboard analytics
  - `GET /api/dashboard/latest` - Get latest imports
  - `POST /api/dashboard/import` - Import dashboard data
  - `POST /leads` - Create lead (protected)
  - `GET /leads/my-leads` - Get user's leads (protected)

### Frontend (React)
- **Port:** 3000
- **API Client:** Axios with automatic JWT token handling
- **Authentication:** JWT tokens stored in localStorage
- **API Base:** Configured in `.env.local`

## Authentication Flow

1. **Register:** User submits form → Backend creates user with `status: 'pending'` → Returns JWT token
2. **Login:** User enters credentials → Backend validates → Returns JWT token on success
3. **Protected Routes:** JWT token automatically added to all requests via axios interceptor
4. **Token Storage:** Stored in `localStorage` as `authToken`

## Key Features Connected

✅ **Authentication**
- Frontend login/register forms connect to backend APIs
- JWT tokens automatically managed
- Session persisted in localStorage

✅ **API Client**
- Centralized axios client with interceptors
- Automatic token injection in requests
- Automatic 401 redirect on token expiry

✅ **API Layers**
- `/src/api/authApi.js` - Authentication endpoints
- `/src/api/dashboardApi.js` - Dashboard data endpoints
- `/src/api/leadsApi.js` - Leads management endpoints

## Testing the Connection

1. Start backend: `npm run dev` (in backEnd folder)
2. Start frontend: `npm start` (in frontEnd folder)
3. Try registering a new account - it should call the backend API
4. Login with registered account - should return JWT token
5. Check browser DevTools → Application → localStorage to see `authToken`

## Troubleshooting

**Issue:** Frontend can't connect to backend
- Verify backend is running on port 5000
- Check `.env.local` has correct `REACT_APP_API_BASE_URL`
- Check CORS is enabled in backend (it is in app.js)
- Check browser console for network errors

**Issue:** Login returns 403 Pending
- New accounts are created with `status: 'pending'`
- Admin must approve account before login is allowed

**Issue:** Database connection fails
- Verify PostgreSQL is running
- Check `DATABASE_URL` in backend `.env`
- Run: `npx prisma migrate dev` to set up database

## Next Steps

To fully complete the integration, the following backend endpoints need to be consumed:

1. **Admin endpoints** (in `AdminRoute`, `ApprovalPendingPage`):
   - User approval/rejection
   - User management
   - Admin dashboard

2. **User profile endpoints**:
   - Update user profile
   - Change password
   - Get user preferences

3. **Real-time data**:
   - Dashboard analytics
   - Lead sources
   - Sales data
   - Replace all mock data in `/data/*.js` files with actual API calls
