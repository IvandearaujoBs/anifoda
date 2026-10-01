import { env } from '../config/env.js';
let nextRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();
export class JikanProvider {
 private async get<T>(path: string): Promise<T> {
  const scheduled = requestQueue.then(async () => { const wait = Math.max(0, nextRequestAt - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); nextRequestAt = Date.now() + env.JIKAN_MIN_INTERVAL_MS; });
  requestQueue = scheduled.catch(() => {}); await scheduled;
  const response = await fetch(`${env.JIKAN_BASE_URL}${path}`, { signal: AbortSignal.timeout(9000), headers: { accept: 'application/json' } });
  if (!response.ok) throw Object.assign(new Error(`Provedor Jikan respondeu ${response.status}`), { status: response.status });
  return await response.json() as T;
 }
 popular(page: number) { return this.get(`/top/anime?page=${page}&limit=24`); }
 seasonNow(page: number) { return this.get(`/seasons/now?page=${page}&limit=24`); }
 search(q: string, page: number, genre?: string, type?: string, status?: string) { const p = new URLSearchParams({ q, page: String(page), limit: '24', sfw: 'true' }); if (genre) p.set('genres', genre); if (type) p.set('type', type); if (status) p.set('status', status); return this.get(`/anime?${p}`); }
 details(id: number) { return this.get(`/anime/${id}/full`); }
 episodes(id: number, page: number) { return this.get(`/anime/${id}/episodes?page=${page}`); }
 episode(id: number, episode: number) { return this.get(`/anime/${id}/episodes/${episode}`); }
 genres() { return this.get('/genres/anime'); }
}
