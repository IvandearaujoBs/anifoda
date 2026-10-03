import { env } from '../config/env.js';
import type { PlaybackProvider, PlaybackSource } from './playback.js';

/**
 * Integration seam for the user's licensed HiAnime API instance.
 *
 * The upstream project documents catalog, details and episode metadata, but
 * does not document a playback-source resolver route. Keep network calls out
 * until the user supplies the authorized route and response contract.
 */
export const hianimeProvider: PlaybackProvider = {
  id: 'hianime',
  enabled: env.PLAYBACK_PROVIDER === 'hianime',
  async sourceForEpisode(_titles: string[], _episodeNumber: number): Promise<PlaybackSource | undefined> {
    // Implement the licensed source resolver here once its exact API contract is known.
    return undefined;
  },
};

export const hianimeIntegrationStatus = {
  provider: hianimeProvider.id,
  enabled: hianimeProvider.enabled,
  apiBaseConfigured: Boolean(env.HIANIME_API_BASE_URL),
  sourceResolverConnected: false,
} as const;
