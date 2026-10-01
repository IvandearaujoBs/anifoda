import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
type Entry = { value: unknown; expires: number };
const memory = new Map<string, Entry>();
let redis: Redis | undefined;
if (env.REDIS_URL) { try { redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }); redis.on('error', () => {}); } catch { redis = undefined; } }
const flights = new Map<string, Promise<unknown>>();
export const cacheStats = { hits: 0, misses: 0, staleFallbacks: 0 };
export function cacheKey(provider: string, resource: string, params: unknown) { return `${provider}:${resource}:${createHash('sha256').update(JSON.stringify(params)).digest('hex')}`; }
export async function getCached<T>(key: string): Promise<T | undefined> {
  if (redis?.status === 'ready') { try { const value = await redis.get(key); if (value) { cacheStats.hits++; return JSON.parse(value) as T; } } catch {} }
  const e = memory.get(key); if (e && e.expires > Date.now()) { cacheStats.hits++; return e.value as T; } cacheStats.misses++; return undefined;
}
export async function setCached(key: string, value: unknown, ttl: number) { memory.set(key, { value, expires: Date.now() + ttl * 1000 }); if (redis?.status === 'ready') try { await redis.set(key, JSON.stringify(value), 'EX', ttl); } catch {} }
export async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
 const hit = await getCached<T>(key); if (hit !== undefined) return hit;
 const existing = flights.get(key); if (existing) return existing as Promise<T>;
 const stale = memory.get(key)?.value as T | undefined;
 const task = loader().then(async value => { await setCached(key, value, ttl); return value; }).catch(error => { if (stale !== undefined) { cacheStats.staleFallbacks++; return stale; } throw error; }).finally(() => flights.delete(key));
 flights.set(key, task); return task;
}
