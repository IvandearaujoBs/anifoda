import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('API REST', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

  it('retorna erro 400 para identificador inválido', async () => {
    const response = await fetch(`${origin}/api/animes/0`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: 'Parâmetros inválidos.' } });
  });

  it('não inventa temporadas quando a fonte não confirma a relação', async () => {
    const response = await fetch(`${origin}/api/animes/1/seasons`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [] });
  });

  it('comunica que não existe fonte de vídeo configurada', async () => {
    const response = await fetch(`${origin}/api/animes/1/episodes/1/source`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ data: null });
  });

  it('retorna o embed oficial permitido apenas para Digimon Adventure: episódio 1', async () => {
    const response = await fetch(`${origin}/api/animes/41074/episodes/1/source`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { provider: 'Toei Animation via YouTube', type: 'youtube-embed', url: 'https://www.youtube-nocookie.com/embed/m113fYKxJk0' } });
  });

  it('salva progresso no perfil local e permite consultá-lo', async () => {
    const profileId = randomUUID();
    const saved = await fetch(`${origin}/api/history/progress`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileId, animeId: 1, episodeId: '1', position: 42, duration: 120 }),
    });
    expect(saved.status).toBe(204);
    const response = await fetch(`${origin}/api/history`, { headers: { 'x-profile-id': profileId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{ anime_id: 1, episode_id: '1', position: 42, duration: 120 }] });
  });
});
