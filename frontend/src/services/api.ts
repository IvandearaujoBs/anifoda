const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export interface Anime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  year?: number | null;
  episodes?: number | null;
  status?: string | null;
  score?: number | null;
  rating?: string | null;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
  genres?: Array<{ mal_id: number; name: string }>;
  studios?: Array<{ name: string }>;
  type?: string | null;
}
export interface Episode { mal_id: number; title: string; title_japanese?: string | null; title_romanji?: string | null; aired?: string | null; sourceAvailable?: boolean; }
export interface PlaybackSource { provider: string; type: 'youtube-embed' | 'hls' | 'mp4'; url: string; title: string; }
interface Page<T> { data: T[]; pagination?: { last_visible_page?: number; has_next_page?: boolean }; }
const read = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${base}/api${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível carregar os dados.');
  return body as T;
};
export const api = {
  popular: (page = 1) => read<Page<Anime>>(`/animes/popular?page=${page}`),
  season: (page = 1) => read<Page<Anime>>(`/animes/season?page=${page}`),
  search: (q: string, page = 1, genre?: string, type?: string, status?: string) => {
    const p = new URLSearchParams({ q, page: String(page) });
    if (genre) p.set('genre', genre); if (type) p.set('type', type); if (status) p.set('status', status);
    return read<Page<Anime>>(`/animes/search?${p}`);
  },
  genres: () => read<{ data: Array<{ mal_id: number; name: string }> }>('/animes/genres'),
  details: (id: number) => read<{ data: Anime }>(`/animes/${id}`),
  episodes: (id: number, page = 1) => read<Page<Episode>>(`/animes/${id}/episodes?page=${page}`),
  source: (id: number, episode: number) => read<{ data: PlaybackSource | null; message?: string }>(`/animes/${id}/episodes/${episode}/source`),
  history: (profileId: string) => read<{ data: Array<{ anime_id: number; episode_id: string; position: number; duration: number | null; updated_at: string }> }>('/history', { headers: { 'x-profile-id': profileId } }),
  saveProgress: (progress: { profileId: string; animeId: number; episodeId: string; position: number; duration?: number }) => fetch(`${base}/api/history/progress`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(progress) }),
};
