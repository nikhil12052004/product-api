/**
 * seed.js
 * Batch-inserts 200,000 product rows with randomised updated_at values
 * so cursor-based pagination on (updated_at, id) is non-trivial to test.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname node seed.js
 *
 * Dependencies:
 *   npm install pg
 */

'use strict';

const { Pool } = require('pg');
require('dotenv').config();

// ─── Config ──────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const TOTAL_RECORDS  = 200_000;   // Total rows to insert
const BATCH_SIZE     = 1_000;     // Rows per INSERT statement
const CONCURRENCY    = 5;         // Parallel batches in flight at once

// ─── Reference Data ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden',
  'Sports', 'Toys', 'Food & Beverage', 'Health & Beauty',
  'Automotive', 'Office Supplies',
];

const ADJECTIVES = [
  'Premium', 'Ultra', 'Classic', 'Pro', 'Eco', 'Smart',
  'Portable', 'Deluxe', 'Essential', 'Advanced',
];

const NOUNS = [
  'Widget', 'Gadget', 'Tool', 'Device', 'Kit', 'Pack',
  'Set', 'Bundle', 'Unit', 'Module',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Random integer in [min, max] inclusive */
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Random element from an array */
const pick = (arr) => arr[randInt(0, arr.length - 1)];

/** Random decimal price between 1.00 and 9 999.99 */
const randPrice = () => (Math.random() * 9_998.99 + 1).toFixed(2);

/**
 * Random timestamp within the past 2 years.
 * Spreads updated_at so pagination cursors are non-trivial.
 */
const randTimestamp = () => {
  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1_000;
  return new Date(Date.now() - Math.random() * TWO_YEARS_MS);
};

/** Build one batch of `count` row tuples */
const buildBatch = (count) =>
  Array.from({ length: count }, () => ({
    name:       `${pick(ADJECTIVES)} ${pick(NOUNS)} ${randInt(100, 9999)}`,
    category:   pick(CATEGORIES),
    price:      randPrice(),
    created_at: randTimestamp(),
    updated_at: randTimestamp(),
  }));

/**
 * Insert a single batch using a multi-row VALUES clause.
 * Parameterised to prevent SQL-injection even for seed data.
 */
async function insertBatch(client, rows) {
  // Build  ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10), …
  const valuesList = rows.map((_, i) => {
    const base = i * 5;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  const sql = `
    INSERT INTO products (name, category, price, created_at, updated_at)
    VALUES ${valuesList.join(', ')}
  `;

  const params = rows.flatMap((r) => [
    r.name, r.category, r.price, r.created_at, r.updated_at,
  ]);

  await client.query(sql, params);
}

// ─── Table Setup ─────────────────────────────────────────────────────────────

async function ensureTable(pool) {
  // ❌ REMOVED: Table creation (already in database.js)
  // ❌ REMOVED: Index creation (already in database.js)
  
  console.log('✓ Table and index already exist (created by database.js)');
}

// ─── Concurrent Batch Runner ──────────────────────────────────────────────────

/**
 * Runs all batches with a sliding window of `concurrency` parallel inserts.
 * Each batch gets its own connection from the pool so transactions don't block.
 */
async function seedWithConcurrency(pool, totalRecords, batchSize, concurrency) {
  const totalBatches = Math.ceil(totalRecords / batchSize);
  let batchIndex     = 0;
  let insertedRows   = 0;
  const startTime    = Date.now();

  console.log(
    `Seeding ${totalRecords.toLocaleString()} rows ` +
    `in ${totalBatches} batches of ${batchSize} (concurrency=${concurrency})…\n`
  );

  // Worker: pulls the next batch index from the shared counter and inserts it
  const worker = async () => {
    while (true) {
      const myIndex = batchIndex++;
      if (myIndex >= totalBatches) break;

      const rowsInBatch = Math.min(batchSize, totalRecords - myIndex * batchSize);
      const rows        = buildBatch(rowsInBatch);
      const client      = await pool.connect();

      try {
        await client.query('BEGIN');
        await insertBatch(client, rows);
        await client.query('COMMIT');

        insertedRows += rowsInBatch;

        const elapsed  = ((Date.now() - startTime) / 1_000).toFixed(1);
        const rps      = (insertedRows / ((Date.now() - startTime) / 1_000)).toFixed(0);
        const pct      = ((insertedRows / totalRecords) * 100).toFixed(1);

        process.stdout.write(
          `\r  ${insertedRows.toLocaleString()} / ${totalRecords.toLocaleString()} ` +
          `rows  [${pct}%]  ${elapsed}s elapsed  ${rps} rows/s   `
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };

  // Launch `concurrency` workers and wait for all to finish
  await Promise.all(Array.from({ length: concurrency }, worker));

  const totalSeconds = ((Date.now() - startTime) / 1_000).toFixed(2);
  console.log(`\n\n✓ Done — ${insertedRows.toLocaleString()} rows in ${totalSeconds}s`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: CONCURRENCY + 2,   // Pool slightly larger than concurrency
  });

  try {
    await ensureTable(pool); // Only checks, doesn't create
    await seedWithConcurrency(pool, TOTAL_RECORDS, BATCH_SIZE, CONCURRENCY);
  } catch (err) {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();