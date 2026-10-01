export interface PlaybackSource {
  provider: string;
  type: 'youtube-embed' | 'hls' | 'mp4';
  url: string;
  title: string;
}

// Provider-neutral contract for configured playback integrations.
export interface PlaybackProvider {
  readonly id: string;
  readonly enabled: boolean;
  sourceForEpisode(titles: string[], episodeNumber: number): Promise<PlaybackSource | undefined>;
}

// Toei Animation's verified Latin America channel published this complete episode.
// Keep this allowlist curated: metadata providers do not grant video distribution rights.
const authorizedVideos = new Map<string, { videoId: string; title: string }>([
  ['41074:1', { videoId: 'm113fYKxJk0', title: 'Digimon Adventure: (2020) — Episódio 1 (legendas em espanhol)' }],
]);

export function sourceForEpisode(animeId: number, episodeId: number): PlaybackSource | undefined {
  const entry = authorizedVideos.get(`${animeId}:${episodeId}`);
  if (!entry || !/^[A-Za-z0-9_-]{11}$/.test(entry.videoId)) return undefined;
  return {
    provider: 'Toei Animation via YouTube',
    type: 'youtube-embed',
    url: `https://www.youtube-nocookie.com/embed/${entry.videoId}`,
    title: entry.title,
  };
}

export function authorizedEpisodes(animeId: number) {
  if (!authorizedVideos.has(`${animeId}:1`)) return [];
  return [{ mal_id: 1, title: 'Digimon Adventure: (2020) — Episódio 1', title_japanese: null, title_romanji: null, aired: null, sourceAvailable: true }];
}
