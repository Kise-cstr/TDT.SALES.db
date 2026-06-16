# Prisma Migration Recovery Plan

This plan is for a PostgreSQL database that already has tables/data but Prisma migration history is missing, failed, or behind. It preserves all records and accounts.

## Diagnosis

- All local migration folders contain `migration.sql`.
- The schema is ahead of migration history on the deployed database.
- `department` was added in both:
  - `20260518010000_add_user_department`
  - `20260602030000_add_user_profile_and_single_session`
- Additive migrations now use `IF NOT EXISTS` so existing tables/columns do not fail deployment.
- A separate additive recovery SQL file exists at:
  - `backEnd/prisma/recovery/20260603_reconcile_existing_schema.sql`

## Never Run

```bash
npx prisma migrate reset
```

Do not drop tables, delete users, or delete production data.

## Server Recovery Commands

Run from the deployed repo root, for example `/var/www/SalesDB/TDT.SALES.db`.

```bash
git pull
cd backEnd
npm install
```

Apply the additive recovery SQL first. This creates only missing tables/columns.

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/recovery/20260603_reconcile_existing_schema.sql
```

Check migration state:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

If a migration is listed as failed, mark it rolled back first, then mark it applied after confirming the objects exist:

```bash
npx prisma migrate resolve --rolled-back 20260515003350_init --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260515003350_init --schema prisma/schema.prisma
```

Repeat that pattern for each failed migration. For migrations that are not failed but are already reflected in the database, mark them applied:

```bash
npx prisma migrate resolve --applied 20260515003350_init --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260518000000_add_sales_reference_columns --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260518010000_add_user_department --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260525000000_add_sales_weight --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260528000000_add_dashboard_upload_ownership --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260528010000_add_user_preferences_and_force_lifecycle --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260528020000_add_account_bound_scan_tokens --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260601000000_add_sales_reporting_tables --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260602030000_add_user_profile_and_single_session --schema prisma/schema.prisma
```

Then verify and generate Prisma Client:

```bash
npm run prisma:recovery:check
npx prisma migrate status --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

Build and restart:

```bash
cd ../frontEnd
npm install
npm run build

cd ..
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

## Verification SQL

Use `psql` or Prisma `db execute` to verify these columns exist.

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name IN (
    'department',
    'position',
    'avatar',
    'activeSessionId',
    'activeSessionAt',
    'animationSpeed',
    'sessionTimeout',
    'forced',
    'tokenVersion'
  )
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'UploadedSalesRecord'
  AND column_name IN (
    'salesmanGkPercent',
    'fob',
    'counter',
    'weight'
  )
ORDER BY column_name;
```

Expected User columns:

```text
activeSessionAt
activeSessionId
animationSpeed
avatar
department
forced
position
sessionTimeout
tokenVersion
```

Expected UploadedSalesRecord columns:

```text
counter
fob
salesmanGkPercent
weight
```
