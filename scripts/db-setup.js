#!/usr/bin/env node
/**
 * Creates the SAFEPATH database and applies server/db/schema.sql (idempotent).
 * Usage: npm run db:setup
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { config } from '../server/config.js';

const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');

async function main() {
  const schema = await fs.readFile(schemaPath, 'utf8');
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  console.log(`Applying schema to ${config.db.user}@${config.db.host}:${config.db.port} ...`);
  await connection.query(schema);
  await connection.query(`USE \`${config.db.database}\`;`);

  const [tables] = await connection.query('SHOW TABLES');
  console.log(`Database "${config.db.database}" ready with ${tables.length} tables:`);
  for (const row of tables) console.log('  -', Object.values(row)[0]);
  await connection.end();
}

main().catch((err) => {
  console.error('\nDatabase setup failed:', err.message);
  console.error(
    '\nCheck that MySQL is running and that DB_HOST/DB_PORT/DB_USER/DB_PASSWORD in your .env are correct.',
  );
  process.exit(1);
});
