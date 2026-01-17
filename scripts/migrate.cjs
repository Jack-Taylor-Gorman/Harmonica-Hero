require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.VITE_DATABASE_URL,
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to Neon!');

    // 1. Songs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        bpm INTEGER NOT NULL,
        "offset" INTEGER DEFAULT 0,
        tabs TEXT NOT NULL,
        metadata JSONB
      );
    `);
    console.log('Created table: songs');

    // 2. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created table: users');

    // 3. User Scores (Composite Key for sync)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_scores (
        user_id UUID REFERENCES users(id),
        song_id TEXT REFERENCES songs(id),
        score INTEGER NOT NULL,
        stars TEXT NOT NULL,
        max_streak INTEGER NOT NULL,
        perfect_count INTEGER NOT NULL,
        good_count INTEGER NOT NULL,
        missed_count INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, song_id)
      );
    `);
    console.log('Created table: user_scores');

    // Seed initial songs if empty
    // We will do this from the App Logic or a separate seed script to keep this clean.
    // But for "hosting songs", we typically want to push our current local list to the DB once.

    console.log('Migration Complete.');
  } catch (err) {
    console.error('Migration Failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
