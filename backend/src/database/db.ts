import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../config/env.js';
const file = resolve(process.cwd(), env.DATABASE_PATH); mkdirSync(dirname(file), { recursive: true });
export const db: InstanceType<typeof Database> = new Database(file);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS progress (profile_id TEXT NOT NULL, anime_id INTEGER NOT NULL, episode_id TEXT NOT NULL, position REAL NOT NULL, duration REAL, updated_at TEXT NOT NULL, PRIMARY KEY(profile_id, anime_id, episode_id)); CREATE INDEX IF NOT EXISTS progress_recent ON progress(profile_id, updated_at DESC);`);
