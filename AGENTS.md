# AI Agent Instructions for PowerSteel Backend

## Project Overview
Node.js backend with Express.js, Prisma ORM, and PostgreSQL for JWT-based user authentication.

## Essential Commands
- Development server: `npm run dev` (nodemon auto-restart)
- Production server: `npm start`

## Architecture
- Server entry: [backend/source/server.js](backend/source/server.js)
- App configuration: [backend/source/app.js](backend/source/app.js)
- Database schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- Database client: [backend/source/config/db.js](backend/source/config/db.js)

## API Conventions
- Response format: `{ success: boolean, message: string, data?: any }`
- HTTP status codes: 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 500 (error)
- Error handling: Use try-catch blocks, return 500 on exceptions

## Authentication Flow
- Registration: POST /api/auth/register (sets status to 'pending')
- Login: POST /api/auth/login (requires 'approved' status)
- Token: 7-day JWT expiry, generated via [backend/source/utils/generateToken.js](backend/source/utils/generateToken.js)

## Database Model
User model with fields: id, firstName, lastName, email (unique), password (hashed), role (default 'sales'), status (pending/approved/rejected), qrToken, createdAt.

## Testing with Thunder Client
Use the Thunder Client VSCode extension for API testing. Key endpoints:
- Register new user
- Login with approved user
- Verify JWT token handling

## Security Notes
- Passwords appear in API responses - remove before production
- No input validation implemented - add email/password checks
- No rate limiting or logout mechanism

## Common Pitfalls
- Pending status users cannot login
- Database connection requires PostgreSQL running
- Environment variables: DATABASE_URL, JWT_SECRET