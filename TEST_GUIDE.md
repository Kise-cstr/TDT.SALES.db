# Frontend-Backend Integration Test Guide

## Pre-Requisites
- PostgreSQL running on localhost:5432
- Node.js installed

## Step-by-Step Testing

### 1. Backend Setup & Start
```bash
cd backEnd
npm install
npx prisma migrate dev  # Setup database
npm run dev
```
Expected output: `Server running on port 5000`

### 2. Frontend Setup & Start
```bash
cd frontEnd
npm install
npm start
```
Expected output: Browser opens to http://localhost:3000

### 3. Test Registration
1. Click "Sign Up" link
2. Fill in form:
   - First Name: Justine
   - Last Name: Manto
   - Email: jmanto@example.com
   - Password: test123456
   - Confirm Password: test123456
3. Click Submit
4. **Expected Result:** 
   - Page redirects to "Approval Pending"
   - Check DevTools → Network tab → see POST /api/auth/register
   - Check DevTools → Storage → localStorage has `authToken`

### 4. Test Login (Admin)
1. Go to Login page
2. Enter credentials:
   - Email: admin@tdtpowersteel.com
   - Password: admin123
3. Click Login
4. **Expected Result:**
   - Logs in successfully (status is already 'approved')
   - Redirected to dashboard
   - DevTools → Storage → localStorage shows `authToken`

### 5. Test Login (Pending Account)
1. Try to login with newly registered account (from step 3)
2. Enter credentials from step 3
3. **Expected Result:** 
   - Receives error message "Waiting for admin approval"
   - Check DevTools → Network → Response shows status: 'pending'

### 6. Verify API Calls
Open DevTools → Network tab and look for:
- ✅ POST /api/auth/register
- ✅ POST /api/auth/login (success)
- ✅ POST /api/auth/login (pending - 403 error expected)
- ✅ All requests have Authorization header with Bearer token

### 7. Test Token Persistence
1. After successful login as admin
2. Refresh the page (Ctrl+R)
3. **Expected Result:**
   - User stays logged in
   - No new login request happens
   - Dashboard loads

### 8. Test Dashboard Data (When Implemented)
1. Once logged in as admin
2. Navigate to dashboard pages
3. Check DevTools → Network for:
   - GET /api/dashboard/analytics
   - GET /api/dashboard/latest

## Common Issues & Fixes

### Issue: CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix:** Backend already has CORS enabled in app.js. Verify both servers are running on correct ports.

### Issue: 404 on API calls
```
POST /api/auth/register 404 Not Found
```
**Fix:** Backend server not running. Start it with `npm run dev` in backEnd folder.

### Issue: Database connection error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Fix:** PostgreSQL not running. Start PostgreSQL service and verify DATABASE_URL in .env

### Issue: Token not being sent
```
Requests to protected routes return 401
```
**Fix:** Check localStorage for `authToken`. Verify axios interceptor in apiClient.js is working.

### Issue: Immediate logout on page load
```
Redirects to login after refresh
```
**Fix:** Check token expiry. Default is 7 days. Create new account to get new token.

## DevTools Checklist
- ✅ Network tab shows API requests to localhost:5000
- ✅ localStorage has `authToken` and `tdt_auth_session`
- ✅ Authorization header: `Bearer <token>`
- ✅ Response includes `success: true` and `data` object
- ✅ Console has no CORS errors

## Next Integration Steps
Once basic auth is working:
1. Replace mock data files with API calls
2. Implement admin approval endpoints
3. Implement user profile update endpoints
4. Connect dashboard to real analytics data
5. Add real-time updates using WebSockets (socket.io-client already installed)

## Success Indicators
- ✅ Registration creates account in database
- ✅ Login returns JWT token
- ✅ Pending accounts cannot login
- ✅ Admin account can login immediately
- ✅ Token persists in localStorage
- ✅ Tokens auto-inject into API requests
- ✅ 401 responses trigger redirect to login
