import { z } from 'zod';
import { env } from '../config/env.js';
import type { PlaybackProvider, PlaybackSource } from './playback.js';

const searchResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
    name: z.string().optional(),
  }).passthrough()),
}).passthrough();

const infoResponseSchema = z.object({
  episodes: z.array(z.object({
    id: z.string(),
    number: z.number().optional(),
    title: z.string().optional(),
  }).passthrough()),
}).passthrough();

const watchResponseSchema = z.object({
  sources: z.array(z.object({
    url: z.string().url(),
    quality: z.string().optional(),
    isM3U8: z.boolean().optional(),
  }).passthrough()),
}).passthrough();

const request = async (path: string) => {
  const base = env.CONSUMET_BASE_URL.endsWith('/') ? env.CONSUMET_BASE_URL : `${env.CONSUMET_BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ''), base);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(env.CONSUMET_TIMEOUT_MS),
    });
    if (!response.ok) throw Object.assign(new Error(`Consumet respondeu ${response.status}`), { status: 502 });
    return await response.json() as unknown;
  } catch (error) {
    if (Number((error as { status?: number })?.status)) throw error;
    const timeout = (error as { name?: string })?.name === 'TimeoutError';
    throw Object.assign(new Error(timeout ? 'Tempo limite ao consultar Consumet.' : 'Não foi possível conectar ao Consumet.'), { status: timeout ? 504 : 502 });
  }
};

const normalize = (value: string) => value
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const sameTitle = (candidate: string, titles: string[]) => {
  const normalizedCandidate = normalize(candidate);
  if (!normalizedCandidate) return false;
  return titles.some(title => {
    const normalizedTitle = normalize(title);
    return normalizedTitle && (
      normalizedCandidate === normalizedTitle ||
      (Math.min(normalizedCandidate.length, normalizedTitle.length) >= 8 &&
        (normalizedCandidate.startsWith(`${normalizedTitle} `) || normalizedTitle.startsWith(`${normalizedCandidate} `)))
    );
  });
};

const qualityRank = (quality?: string) => {
  const match = quality?.match(/(\d{3,4})p/i);
  return match ? Number(match[1]) : 0;
};

const parseUpstream = <T>(schema: z.ZodType<T>, payload: unknown): T => {
  try { return schema.parse(payload); }
  catch { throw Object.assign(new Error('Consumet retornou uma resposta em formato inesperado.'), { status: 502 }); }
};

export async function consumetSourceForEpisode(titles: string[], episodeNumber: number): Promise<PlaybackSource | undefined> {
  if (!env.CONSUMET_ENABLED) return undefined;
  const title = titles.find(value => value.trim());
  if (!title || !Number.isInteger(episodeNumber) || episodeNumber < 1) return undefined;

  const searchPath = `anime/${encodeURIComponent(env.CONSUMET_ANIME_PROVIDER)}/${encodeURIComponent(title)}?page=1`;
  const search = parseUpstream(searchResponseSchema, await request(searchPath));
  const anime = search.results.find(result => sameTitle(result.title ?? result.name ?? '', titles));
  if (!anime) return undefined;

  const info = parseUpstream(infoResponseSchema, await request(
    `anime/${encodeURIComponent(env.CONSUMET_ANIME_PROVIDER)}/info/${encodeURIComponent(anime.id)}`,
  ));
  const episode = info.episodes.find(item => item.number === episodeNumber);
  if (!episode) return undefined;

  const watch = parseUpstream(watchResponseSchema, await request(
    `anime/${encodeURIComponent(env.CONSUMET_ANIME_PROVIDER)}/watch/${encodeURIComponent(episode.id)}`,
  ));
  const source = [...watch.sources]
    .filter(item => new URL(item.url).protocol === 'https:')
    .sort((a, b) => {
      const aHls = a.isM3U8 === true || /\.m3u8(?:$|\?)/i.test(a.url);
      const bHls = b.isM3U8 === true || /\.m3u8(?:$|\?)/i.test(b.url);
      return Number(aHls) - Number(bHls) || qualityRank(b.quality) - qualityRank(a.quality);
    })[0];
  if (!source) return undefined;

  const isHls = source.isM3U8 === true || /\.m3u8(?:$|\?)/i.test(source.url);
  return {
    provider: `Consumet / ${env.CONSUMET_ANIME_PROVIDER}`,
    type: isHls ? 'hls' : 'mp4',
    url: source.url,
    title: `${title} — Episódio ${episodeNumber}`,
  };
}

export const consumetProvider: PlaybackProvider = {
  id: 'consumet',
  enabled: env.CONSUMET_ENABLED,
  sourceForEpisode: consumetSourceForEpisode,
};

export const consumetIntegrationStatus = {
  provider: consumetProvider.id,
  scraper: env.CONSUMET_ANIME_PROVIDER,
  enabled: consumetProvider.enabled,
} as const;
