import { api, type Anime, type Episode } from './services/api';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
const profileKey = 'animeverse-profile';
const getProfile = () => {
  let value = localStorage.getItem(profileKey);
  if (!value) { value = globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); localStorage.setItem(profileKey, value); }
  return value;
};
const profileId = getProfile();
const esc = (s = '') => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const image = (a: Anime) => a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '';
const animeId = (a: Anime) => a.id ?? a.mal_id ?? 0;
const year = (a: Anime) => a.year ? String(a.year) : 'Ano indisponível';
const animeById = new Map<number, Anime>();
const card = (a: Anime) => { const id = animeId(a); animeById.set(id, a); return `<button class="anime-card" data-anime="${id}" aria-label="Ver ${esc(a.title)}"><span class="poster">${image(a) ? `<img loading="lazy" src="${esc(image(a))}" alt="Capa de ${esc(a.title)}">` : '<span class="poster-fallback">AV</span>'}<span class="score">${a.score ? `★ ${a.score}` : 'Anime'}</span></span><span class="card-title">${esc(a.title)}</span><span class="muted">${esc(year(a))} · ${esc(a.status || a.type || 'Status indisponível')}</span></button>`; };
const section = (id: string, title: string) => `<section class="shelf"><div class="shelf-heading"><h2>${title}</h2><button class="text-button" data-explore="${id}">Ver catálogo</button></div><div class="card-row" id="${id}"><div class="loading-line">Carregando catálogo…</div></div></section>`;
root.innerHTML = `<header class="topbar"><a class="brand" href="#top" aria-label="AnimeVerse início"><span class="brand-mark">A</span>AnimeVerse</a><nav><a href="#popular">Populares</a><a href="#season">Em exibição</a></nav><button class="button button-small" id="explore">Explorar animes</button></header><main id="top"><section class="hero"><div class="hero-copy"><p class="eyebrow">SEU PRÓXIMO ANIME COMEÇA AQUI</p><h1>Histórias que<br><span>ficam com você.</span></h1><p class="hero-description">Explore títulos, descubra informações e acompanhe episódios do catálogo selecionado.</p><button class="button" id="heroExplore">Explorar catálogo <span aria-hidden="true">→</span></button><p class="hero-note">Catálogo de metadados · Reprodução via Consumet</p></div><div class="hero-art" aria-hidden="true"><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="art-caption">ANIME<br><b>VERSE</b></div></div></section><div id="homeNotice" class="notice hidden"></div><div id="popular">${section('popularList','Populares')}</div><div id="season">${section('seasonList','Em exibição')}</div><section class="local-note"><span class="note-icon">◷</span><div><strong>Seu progresso fica neste dispositivo</strong><p>Um perfil local anônimo guarda o histórico. Ele não sincroniza entre dispositivos.</p></div></section></main><footer>Metadados do provedor de catálogo selecionado. AnimeVerse não hospeda vídeos.</footer><div id="overlay" class="overlay hidden" role="presentation"></div><div id="toast" class="toast" role="status" aria-live="polite"></div>`;

let modalPage = 1, modalQuery = '', searchTimer = 0, lastFocus: HTMLElement | null = null;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const toast = (message: string) => { const el = document.querySelector<HTMLDivElement>('#toast')!; el.textContent = message; el.classList.add('show'); window.setTimeout(() => el.classList.remove('show'), 3200); };
const fillShelf = async (id: string, load: () => Promise<{ data: Anime[] }>) => {
  const el = document.querySelector<HTMLDivElement>(`#${id}`)!;
  try { const result = await load(); el.innerHTML = result.data.length ? result.data.map(card).join('') : '<p class="muted">Nenhum título disponível.</p>'; }
  catch (e) { el.innerHTML = `<p class="inline-error">${esc(e instanceof Error ? e.message : 'Falha ao carregar.')} <button class="text-button" data-retry="${id}">Tentar novamente</button></p>`; }
};
void fillShelf('popularList', () => api.popular());
void fillShelf('seasonList', () => api.season());

const openModal = async () => {
  lastFocus = document.activeElement as HTMLElement;
  overlay.innerHTML = `<section class="dialog catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="catalogTitle"><div class="dialog-head"><div><p class="eyebrow">CATÁLOGO</p><h2 id="catalogTitle">Encontre seu próximo anime</h2></div><button class="icon-button" data-close aria-label="Fechar">×</button></div><div class="catalog-tools"><label class="search-box"><span aria-hidden="true">⌕</span><input id="catalogSearch" type="search" placeholder="Buscar por título…" autocomplete="off"></label><select id="genreFilter" aria-label="Filtrar por gênero"><option value="">Todos os gêneros</option></select><select id="typeFilter" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option><option value="tv">TV</option><option value="movie">Filme</option><option value="ova">OVA</option><option value="ona">ONA</option></select><select id="statusFilter" aria-label="Filtrar por situação"><option value="">Qualquer situação</option><option value="airing">Em exibição</option><option value="complete">Concluído</option><option value="upcoming">Em breve</option></select></div><div id="catalogStatus" class="catalog-status" aria-live="polite">Carregando…</div><div id="catalogResults" class="catalog-grid"></div><div class="dialog-foot"><span id="pageLabel" class="muted"></span><div><button class="button button-quiet" id="previousPage" disabled>Anterior</button><button class="button button-quiet" id="nextPage">Próxima</button></div></div></section>`;
  overlay.classList.remove('hidden'); document.body.classList.add('modal-open');
  overlay.querySelector<HTMLElement>('[data-close]')?.focus();
  const input = document.querySelector<HTMLInputElement>('#catalogSearch')!; input.focus();
  try { const result = await api.genres(); document.querySelector<HTMLSelectElement>('#genreFilter')!.innerHTML += result.data.map(g => `<option value="${g.mal_id}">${esc(g.name)}</option>`).join(''); } catch { /* filtros continuam disponíveis */ }
  const run = async (reset = true) => {
    if (reset) modalPage = 1;
    const status = document.querySelector<HTMLDivElement>('#catalogStatus')!;
    const cards = document.querySelector<HTMLDivElement>('#catalogResults')!;
    status.textContent = 'Buscando títulos…'; cards.innerHTML = '';
    try {
      const query = input.value.trim();
      const result = query ? await api.search(query, modalPage, value('#genreFilter'), value('#typeFilter'), value('#statusFilter')) : await api.popular(modalPage);
      cards.innerHTML = result.data.length ? result.data.map(card).join('') : '<p class="empty-state">Nenhum resultado. Tente outro nome ou filtro.</p>';
      status.textContent = `${result.data.length} títulos nesta página`;
      document.querySelector<HTMLSpanElement>('#pageLabel')!.textContent = `Página ${modalPage}`;
      document.querySelector<HTMLButtonElement>('#previousPage')!.disabled = modalPage <= 1;
      document.querySelector<HTMLButtonElement>('#nextPage')!.disabled = !result.pagination?.has_next_page;
    } catch (e) { status.innerHTML = `${esc(e instanceof Error ? e.message : 'Falha na busca.')} <button class="text-button" id="retrySearch">Tentar novamente</button>`; }
  };
  const value = (selector: string) => (document.querySelector<HTMLSelectElement>(selector)?.value || undefined);
  input.addEventListener('input', () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void run(), 350); });
  for (const id of ['genreFilter','typeFilter','statusFilter']) document.querySelector(`#${id}`)!.addEventListener('change', () => void run());
  document.querySelector('#previousPage')!.addEventListener('click', () => { modalPage--; void run(false); });
  document.querySelector('#nextPage')!.addEventListener('click', () => { modalPage++; void run(false); });
  overlay.onclick = event => {
    const target = event.target as HTMLElement;
    if (target === overlay || target.closest('[data-close]')) closeModal();
    if (target.closest('#retrySearch')) void run(false);
  };
  void run();
};
const closeModal = () => { overlay.classList.add('hidden'); document.body.classList.remove('modal-open'); overlay.innerHTML = ''; lastFocus?.focus(); };
document.querySelector('#explore')!.addEventListener('click', () => void openModal());
document.querySelector('#heroExplore')!.addEventListener('click', () => void openModal());
document.addEventListener('keydown', event => {
  if (overlay.classList.contains('hidden')) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key === 'Tab') {
    const focusable = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href],[tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  if (target.closest('[data-explore]')) void openModal();
  const retry = target.closest<HTMLElement>('[data-retry]'); if (retry) void fillShelf(retry.dataset.retry!, retry.dataset.retry === 'popularList' ? () => api.popular() : () => api.season());
  const animeCard = target.closest<HTMLElement>('[data-anime]'); if (animeCard) { const id = Number(animeCard.dataset.anime); closeModal(); void openDetails(id); }
});

async function openDetails(id: number) {
  overlay.innerHTML = `<section class="dialog detail-dialog" role="dialog" aria-modal="true" aria-label="Detalhes do anime"><button class="icon-button detail-close" data-close aria-label="Fechar detalhes">×</button><div class="detail-loading">Carregando informações…</div></section>`;
  overlay.classList.remove('hidden'); document.body.classList.add('modal-open');
  overlay.onclick = event => { if (event.target === overlay || (event.target as HTMLElement).closest('[data-close]')) closeModal(); };
  try {
    let a = animeById.get(id);
    try { a = (await api.details(id)).data; } catch (error) { if (!a) throw error; toast('Mostrando os dados do catálogo; os detalhes completos estão indisponíveis no momento.'); }
    if (!a) throw new Error('Anime não encontrado no catálogo.');
    let episodes: Episode[] = [];
    let episodePagination: { has_next_page?: boolean } | undefined;
    let episodeError = '';
    try { const result = await api.episodes(id, 1); episodes = result.data; episodePagination = result.pagination; }
    catch (error) { episodeError = error instanceof Error ? error.message : 'Não foi possível carregar os episódios agora.'; }
    const saved = await api.history(profileId).catch(() => ({ data: [] as Array<{anime_id:number; episode_id:string; position:number}> }));
    const progress = saved.data.find(item => item.anime_id === id);
    const detail = document.querySelector<HTMLDivElement>('.detail-dialog')!;
    detail.innerHTML = `<button class="icon-button detail-close" data-close aria-label="Fechar detalhes">×</button><div class="detail-layout"><div class="detail-poster">${image(a) ? `<img src="${esc(image(a))}" alt="Capa de ${esc(a.title)}">` : '<div class="poster-fallback">AV</div>'}</div><div class="detail-copy"><p class="eyebrow">DETALHES DO TÍTULO</p><h2>${esc(a.title)}</h2>${a.title_japanese ? `<p class="original-title">${esc(a.title_japanese)}</p>` : ''}<div class="meta-line"><span>${esc(year(a))}</span><span>${esc(a.status || 'Status indisponível')}</span><span>${a.episodes ? `${a.episodes} episódios` : 'Quantidade de episódios indisponível'}</span>${a.score ? `<span>★ ${a.score}</span>` : ''}</div><p class="synopsis">${esc(a.synopsis || 'Sinopse indisponível na fonte.')}</p><div class="tag-row">${(a.genres || []).map(g => `<span class="tag">${esc(g.name)}</span>`).join('')}</div><dl class="facts"><div><dt>Estúdio</dt><dd>${esc(a.studios?.map(s => s.name).join(', ') || 'Não informado')}</dd></div><div><dt>Classificação</dt><dd>${esc(a.rating || 'Não informada')}</dd></div></dl></div></div><div class="episodes-layout"><div><div class="shelf-heading"><h3>Episódios disponíveis</h3><span class="muted">Temporadas não informadas pela fonte</span></div><p class="season-info">A fonte consultada lista episódios do anime, mas não confirma agrupamento por temporada. A lista abaixo mantém a numeração fornecida pelo provedor.</p>${episodeError ? `<p class="inline-error">${esc(episodeError)} <button class="text-button" id="retryEpisodes">Tentar novamente</button></p>` : ''}<div id="episodeList" class="episode-list">${episodes.length ? episodes.map(ep => `<button class="episode-row" data-episode="${ep.mal_id}" data-title="${esc(ep.title)}"><span class="episode-number">${ep.mal_id.toString().padStart(2,'0')}</span><span><strong>${esc(ep.title || `Episódio ${ep.mal_id}`)}</strong><small>${ep.aired ? esc(new Date(ep.aired).toLocaleDateString('pt-BR')) : 'Data não informada'}</small></span><span class="episode-state">${ep.sourceAvailable ? 'Vídeo oficial' : 'Metadados'}</span></button>`).join('') : episodeError ? '' : '<p class="muted">Nenhum episódio listado pela fonte.</p>'}</div>${episodePagination?.has_next_page ? `<button class="button button-quiet" id="moreEpisodes" data-page="2">Carregar mais episódios</button>` : ''}</div><aside class="player-panel"><div class="player-screen"><span class="play-disabled">▶</span><p>Reprodução indisponível</p></div><h3>Este catálogo não fornece vídeos</h3><p>Não há uma fonte de reprodução autorizada configurada para este episódio.</p>${progress ? `<p class="progress-resume">Último progresso salvo: episódio ${esc(progress.episode_id)}, ${Math.floor(progress.position)}s.</p>` : ''}<span class="provider-label">Player aguardando provedor autorizado</span></aside></div>`;
    detail.querySelector<HTMLElement>('[data-close]')?.focus();
    detail.querySelector('[data-close]')!.addEventListener('click', closeModal);
    detail.querySelectorAll<HTMLElement>('[data-episode]').forEach(row => row.addEventListener('click', async () => { try { await api.source(id, Number(row.dataset.episode)); toast('Não há vídeo autorizado disponível para este episódio.'); } catch { toast('Não há vídeo autorizado disponível para este episódio.'); } }));
    detail.addEventListener('click', event => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-episode]');
      if (!row) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void (async () => {
        try {
          const result = await api.source(id, Number(row.dataset.episode));
          if (!result.data) { toast(result.message || 'Não há vídeo autorizado disponível para este episódio.'); return; }
          const videoUrl = new URL(result.data.url);
          if (videoUrl.protocol !== 'https:') throw new Error('A fonte de vídeo precisa usar HTTPS.');
          let player: HTMLIFrameElement | HTMLVideoElement;
          if (result.data.type === 'youtube-embed') {
            if (videoUrl.hostname !== 'www.youtube-nocookie.com' || !/^\/embed\/[A-Za-z0-9_-]{11}$/.test(videoUrl.pathname)) throw new Error('Fonte de vídeo inválida.');
            const frame = document.createElement('iframe');
            frame.src = videoUrl.href; frame.title = result.data.title; frame.allowFullscreen = true;
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            player = frame;
          } else {
            if (result.data.type === 'mp4' && !/\.mp4(?:$|\?)/i.test(videoUrl.href)) throw new Error('Formato MP4 inválido.');
            if (result.data.type === 'hls' && !/\.m3u8(?:$|\?)/i.test(videoUrl.href)) throw new Error('Formato HLS inválido.');
            const video = document.createElement('video');
            video.src = videoUrl.href; video.title = result.data.title; video.controls = true; video.playsInline = true; video.preload = 'metadata';
            if (result.data.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) toast('Este navegador não reproduz HLS nativamente; tente abrir em um navegador com suporte HLS.');
            player = video;
          }
          detail.querySelector('.player-screen')?.replaceChildren(player);
          const panel = detail.querySelector('.player-panel');
          if (panel) { const heading = panel.querySelector('h3'); if (heading) heading.textContent = result.data.title; const copy = panel.querySelector('p:not(.progress-resume)'); if (copy) copy.textContent = `Fonte: ${result.data.provider}.`; }
        } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível carregar o vídeo.'); }
      })();
    }, { capture: true });
    detail.querySelector<HTMLButtonElement>('#retryEpisodes')?.addEventListener('click', () => void openDetails(id));
    detail.querySelector<HTMLButtonElement>('#moreEpisodes')?.addEventListener('click', async event => {
      const button = event.currentTarget as HTMLButtonElement; button.disabled = true; button.textContent = 'Carregando…';
      try { const result = await api.episodes(id, Number(button.dataset.page)); const list = detail.querySelector('#episodeList')!; list.insertAdjacentHTML('beforeend', result.data.map(ep => `<button class="episode-row" data-episode="${ep.mal_id}" data-title="${esc(ep.title)}"><span class="episode-number">${ep.mal_id.toString().padStart(2,'0')}</span><span><strong>${esc(ep.title || `Episódio ${ep.mal_id}`)}</strong><small>${ep.aired ? esc(new Date(ep.aired).toLocaleDateString('pt-BR')) : 'Data não informada'}</small></span><span class="episode-state">${ep.sourceAvailable ? 'Vídeo oficial' : 'Metadados'}</span></button>`).join('')); button.dataset.page = String(Number(button.dataset.page) + 1); button.disabled = !result.pagination?.has_next_page; button.textContent = result.pagination?.has_next_page ? 'Carregar mais episódios' : 'Fim da lista'; } catch { button.disabled = false; button.textContent = 'Tentar novamente'; }
    });
  } catch (e) { overlay.querySelector('.detail-dialog')!.innerHTML = `<button class="icon-button detail-close" data-close aria-label="Fechar">×</button><div class="error-state"><h2>Não foi possível abrir este anime</h2><p>${esc(e instanceof Error ? e.message : 'Tente novamente.')}</p><button class="button" id="retryDetail">Tentar novamente</button></div>`; overlay.querySelector('[data-close]')!.addEventListener('click', closeModal); overlay.querySelector('#retryDetail')!.addEventListener('click', () => void openDetails(id)); }
}
