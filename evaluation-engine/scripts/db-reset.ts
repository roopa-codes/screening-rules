/* Local dev only: drops everything in the public schema, recreates tables and loads demo data. */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'screening',
  });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  for (const file of ['schema.sql', 'seed.sql']) {
    await client.query(readFileSync(join(__dirname, '..', 'db', file), 'utf8'));
    console.log(`applied db/${file}`);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
