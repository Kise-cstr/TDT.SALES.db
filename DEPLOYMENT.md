# Deployment Autostart

Use PM2 to keep the production site running after deploys, crashes, and server reboots. PM2 starts the Express backend, and the backend serves the built frontend from `frontEnd/build` automatically when that folder exists. Do not run `npm start` inside `frontEnd` on the server; that is only the React development server.

Run these from the deployed repo root, for example `/var/www/SalesDB/TDT.SALES.db`.

## First-Time Server Setup

Install PM2 once if it is not already installed:

```bash
npm install -g pm2
```

Make sure `backEnd/.env` exists and contains the production values:

```text
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
PORT=5000
```

If the site is behind Nginx or another reverse proxy, point the public site to the backend port, usually `http://127.0.0.1:5000`.

## One-Command Deploy

```bash
git pull

npm install

npm --prefix backEnd install

npm --prefix frontEnd install

npm run deploy:all
```

This automatically:

* Installs root dependencies
* Installs backend dependencies
* Installs frontend dependencies
* Installs newly added packages such as `dotenv` and `jsqr`
* Applies Prisma migrations
* Regenerates Prisma Client
* Builds the frontend
* Reloads PM2
* Saves the PM2 process list for reboot autostart

## Manual Deploy Sequence

```bash
git pull

npm install

cd backEnd
npm install
npx prisma migrate deploy
npx prisma generate

cd ../frontEnd
npm install
npm run build

cd ..
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

After the build finishes, confirm the frontend bundle exists:

```bash
test -f frontEnd/build/index.html && echo "Frontend build ready"
```

The `tdt-sales-dashboard` PM2 process serves both:

```text
/api/* routes from the backend
all other routes from frontEnd/build
```

## Dependency Verification

Verify required packages are installed:

```bash
npm --prefix backEnd ls prisma
npm --prefix backEnd ls @prisma/client
npm --prefix backEnd ls dotenv

npm --prefix frontEnd ls jsqr
```

If any package is missing:

```bash
npm install
npm --prefix backEnd install
npm --prefix frontEnd install
```

## Prisma Recovery

If the deployed database already has tables but Prisma migration history is not aligned, replace:

```bash
npx prisma migrate deploy
```

with:

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/recovery/20260603_reconcile_existing_schema.sql

npx prisma migrate status --schema prisma/schema.prisma
```

Then mark only the migrations whose objects already exist as applied.

If Prisma reports a migration as failed:

```bash
npx prisma migrate resolve --rolled-back <migration_name> --schema prisma/schema.prisma

npx prisma migrate resolve --applied <migration_name> --schema prisma/schema.prisma
```

Use the detailed recovery checklist in:

```text
backEnd/prisma/recovery/MIGRATION_RECOVERY_PLAN.md
```

## Reboot Autostart

To make PM2 start the site automatically when the server reboots:

```bash
pm2 startup
```

PM2 will print one command. Run the printed command once, then:

```bash
pm2 save
```

After reboot:

```bash
pm2 status

pm2 logs tdt-sales-dashboard

curl -I http://127.0.0.1:5000

curl -i -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"healthcheck@example.com","password":"healthcheck"}'
```

## Useful Commands

```bash
pm2 restart tdt-sales-dashboard

pm2 startOrReload ecosystem.config.cjs --env production

pm2 save
```
