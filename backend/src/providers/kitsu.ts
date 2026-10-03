import { env } from '../config/env.js';

type KitsuItem = { id: string; type: string; attributes: Record<string, any>; relationships?: Record<string, { data?: Array<{ id: string; type: string }> }> };
type KitsuResponse = { data: KitsuItem[] | KitsuItem; included?: KitsuItem[]; links?: { next?: string | null; last?: string | null } };
const clean = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const categorySlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class KitsuProvider {
 readonly id = 'kitsu';
 private nextRequestAt = 0;
 private queue: Promise<void> = Promise.resolve();

 private async get(path: string): Promise<KitsuResponse> {
  const scheduled = this.queue.then(async () => { const wait = Math.max(0, this.nextRequestAt - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); this.nextRequestAt = Date.now() + 650; });
  this.queue = scheduled.catch(() => {}); await scheduled;
  const baseUrl = new URL(env.KITSU_BASE_URL);
  if (baseUrl.hostname === 'kitsu.io' && baseUrl.pathname === '/') baseUrl.pathname = '/api/edge/';
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/';
  const url = new URL(path.replace(/^\//, ''), baseUrl);
  let response: Response;
  try { response = await fetch(url, { headers: { accept: 'application/vnd.api+json', 'user-agent': 'AniFoda/1.0' }, signal: AbortSignal.timeout(8000) }); }
  catch (error) { const timeout = (error as { name?: string }).name === 'TimeoutError'; throw Object.assign(new Error(timeout ? 'A API Kitsu demorou para responder.' : 'Não foi possível conectar à API Kitsu.'), { status: timeout ? 504 : 502, provider: this.id }); }
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(body); }
  catch {
   const html = /^\s*<!doctype html|^\s*<html/i.test(body);
   throw Object.assign(new Error(html
    ? `Kitsu retornou uma página HTML (HTTP ${response.status}, ${contentType || 'tipo não informado'}) em ${url.origin}${url.pathname}.`
    : `Kitsu retornou uma resposta que não é JSON (HTTP ${response.status}, ${contentType || 'tipo não informado'}) em ${url.origin}${url.pathname}.`), { status: 502, provider: this.id });
  }
  if (!response.ok) throw Object.assign(new Error(`Kitsu respondeu HTTP ${response.status}.`), { status: response.status === 429 ? 429 : 502, provider: this.id });
  return payload as KitsuResponse;
 }

 private anime(item: KitsuItem, included: KitsuItem[] = []) {
  const a = item.attributes, categories = item.relationships?.categories?.data ?? [];
  const studios = (item.relationships?.animeProductions?.data ?? []).map(ref => included.find(x => x.type === ref.type && x.id === ref.id)).filter(Boolean).map(x => {
   const rel = x!.relationships?.producer?.data?.[0]; const producer = rel && included.find(y => y.type === rel.type && y.id === rel.id); return clean(producer?.attributes.name);
  }).filter((x): x is string => Boolean(x));
  return { id: Number(item.id), mal_id: null, title: clean(a.titles?.en) || clean(a.titles?.en_jp) || clean(a.canonicalTitle) || `Anime ${item.id}`, title_english: clean(a.titles?.en), title_japanese: clean(a.titles?.ja_jp), synopsis: clean(a.synopsis), year: a.startDate ? Number(String(a.startDate).slice(0, 4)) || null : null, episodes: typeof a.episodeCount === 'number' ? a.episodeCount : null, status: ({ current: 'Em exibição', finished: 'Concluído', upcoming: 'Em breve', tba: 'A definir' } as Record<string,string>)[a.status] ?? a.status ?? null, type: clean(a.subtype) || clean(a.showType), score: a.averageRating ? Number(a.averageRating) / 10 : null, rating: clean(a.ageRating), images: { jpg: { large_image_url: clean(a.posterImage?.large) || clean(a.posterImage?.original) || clean(a.posterImage?.small) } }, genres: categories.map(ref => included.find(x => x.type === ref.type && x.id === ref.id)).filter(Boolean).map(x => ({ mal_id: x!.id, name: clean(x!.attributes.title) || clean(x!.attributes.slug) || '' })), studios };
 }

 private async listing(path: string) {
  const response = await this.get(path); const rows = Array.isArray(response.data) ? response.data : [];
  const includes = response.included ?? [];
  return { data: rows.map(row => this.anime(row, includes)), pagination: { has_next_page: Boolean(response.links?.next), last_visible_page: response.links?.last ? 2 : 1 } };
 }
 popular(page: number) { const q = new URLSearchParams({ sort: '-userCount', 'page[limit]': '20', 'page[offset]': String((page - 1) * 20) }); return this.listing(`/anime?${q}`); }
 seasonNow(page: number) { const date = new Date(), month = date.getUTCMonth(), season = month < 3 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'fall'; const q = new URLSearchParams({ 'filter[season]': season, 'filter[seasonYear]': String(date.getUTCFullYear()), sort: '-userCount', 'page[limit]': '20', 'page[offset]': String((page - 1) * 20) }); return this.listing(`/anime?${q}`); }
 search(q: string, page: number, genre?: string, type?: string, status?: string) { const p = new URLSearchParams({ 'filter[text]': q, sort: '-userCount', 'page[limit]': '20', 'page[offset]': String((page - 1) * 20) }); if (genre) p.set('filter[categories]', genre); if (type) p.set('filter[subtype]', ({ tv: 'TV', movie: 'movie', ova: 'OVA', special: 'special', ona: 'ONA', music: 'music' } as Record<string,string>)[type] ?? type); if (status) p.set('filter[status]', ({ airing: 'current', complete: 'finished', upcoming: 'upcoming' } as Record<string,string>)[status] ?? status); return this.listing(`/anime?${p}`); }
 async details(id: number) { const p = new URLSearchParams({ include: 'categories,animeProductions.producer' }); const response = await this.get(`/anime/${id}?${p}`); const item = Array.isArray(response.data) ? response.data[0] : response.data; return { data: this.anime(item, response.included) }; }
 async episodes(id: number, page: number) { const p = new URLSearchParams({ 'page[limit]': '20', 'page[offset]': String((page - 1) * 20) }); const response = await this.get(`/anime/${id}/episodes?${p}`); const rows = Array.isArray(response.data) ? response.data : []; return { data: rows.map(row => ({ mal_id: Number(row.attributes.number) || 0, title: clean(row.attributes.canonicalTitle) || clean(row.attributes.titles?.en) || `Episódio ${row.attributes.number ?? ''}`, title_japanese: clean(row.attributes.titles?.ja_jp), title_romanji: clean(row.attributes.titles?.en_jp), aired: clean(row.attributes.airdate), sourceAvailable: false })), pagination: { has_next_page: Boolean(response.links?.next) } }; }
 async episode(id: number, episodeNumber: number) { const response = await this.episodes(id, 1); const row = response.data.find(x => x.mal_id === episodeNumber); if (!row) throw Object.assign(new Error('Episódio não encontrado.'), { status: 404, provider: this.id }); return { data: row }; }
 async genres() { const q = new URLSearchParams({ 'page[limit]': '20', sort: 'title' }); const response = await this.get(`/categories?${q}`); const rows = Array.isArray(response.data) ? response.data : []; return { data: rows.map(row => ({ mal_id: categorySlug(clean(row.attributes.slug) || clean(row.attributes.title) || row.id), name: clean(row.attributes.title) || clean(row.attributes.slug) || row.id })) }; }
}
