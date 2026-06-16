const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const requiredColumns = {
  User: [
    'department',
    'position',
    'avatar',
    'activeSessionId',
    'activeSessionAt',
    'animationSpeed',
    'sessionTimeout',
    'forced',
    'tokenVersion',
  ],
  UploadedSalesRecord: [
    'salesmanGkPercent',
    'fob',
    'counter',
    'weight',
  ],
};

const quoteSql = value => `'${String(value).replace(/'/g, "''")}'`;

async function getColumns(tableName, columns) {
  const columnList = columns.map(quoteSql).join(',');
  return prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${quoteSql(tableName)}
      AND column_name IN (${columnList})
    ORDER BY column_name
  `);
}

async function main() {
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const rows = await getColumns(tableName, columns);
    const existing = rows.map(row => row.column_name);
    const missing = columns.filter(column => !existing.includes(column));

    console.log(`${tableName} existing: ${existing.join(', ') || '(none)'}`);
    console.log(`${tableName} missing: ${missing.join(', ') || '(none)'}`);
  }
}

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
