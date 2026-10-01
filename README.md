# AnimeVerse

Catálogo responsivo de animes com metadados reais do [Jikan API](https://docs.api.jikan.moe/), baseado no MyAnimeList. O projeto separa front-end Vite/TypeScript e API Express/TypeScript.

## Requisitos

- Node.js 20 ou superior
- npm
- Redis opcional (sem Redis, o cache usa memória local)

## Executar em desenvolvimento

Na raiz do projeto:

```sh
npm install
npm run dev
```

Abra `http://localhost:5173`. O Vite encaminha `/api` para a API em `http://localhost:3000`. No Windows, os mesmos comandos funcionam no PowerShell; Linux e macOS também são suportados.

Copie `.env.example` para `.env` antes de personalizar as configurações. O backend lê esse arquivo com dotenv. `VITE_API_URL` é opcional: use uma URL base, sem `/api`, quando front-end e API estiverem hospedados em origens diferentes.

## Build e produção

```sh
npm run build
npm start
```

O build do front-end fica em `frontend/dist`; o do backend em `backend/dist`. Sirva os arquivos estáticos do front-end por um servidor web e configure `VITE_API_URL` antes do build para apontar à API. Execute a API com `npm start`. A API usa a porta 3000 por padrão.

## Funcionalidades

- Trilhos de animes populares e em exibição, com capas, ano e status retornados pela fonte.
- Modal de catálogo com busca debounced, filtros por gênero, tipo e situação, paginação, estados de erro e vazio, Escape e clique fora.
- Detalhes, sinopse, gêneros, classificação, estúdios e lista paginada de episódios, conforme disponíveis no Jikan.
- Perfil local anônimo enviado pela interface e endpoints de histórico/progresso persistidos em SQLite. Sem um player ativo, a interface só exibe um progresso se já tiver sido enviado ao endpoint; o perfil não sincroniza entre dispositivos.
- Cache em memória com TTL, deduplicação de chamadas simultâneas, fallback para cópia expirada após falha do provedor e Redis opcional.
- Reprodução por embed oficial do YouTube quando disponível, com Consumet como provedor configurado para resolver título, episódio e fonte de vídeo.

## API interna

Todos os endpoints usam JSON. Respostas de catálogo colocam os dados em `data` e a paginação do provedor em `pagination`.

| Método e caminho | Uso |
| --- | --- |
| `GET /api/health` | Estado da API |
| `GET /api/providers` | Estado e configuração do Consumet |
| `GET /api/animes/popular?page=1` | Títulos populares |
| `GET /api/animes/season?page=1` | Títulos da temporada atual |
| `GET /api/animes/search?q=...&page=1&genre=&type=&status=` | Busca e filtros |
| `GET /api/animes/genres` | Gêneros |
| `GET /api/animes/:id` | Detalhes |
| `GET /api/animes/:id/seasons` | Informa que a fonte não fornece temporadas confiáveis |
| `GET /api/animes/:id/episodes?page=1` | Episódios publicados pela fonte |
| `GET /api/animes/:id/episodes/:episodeId` | Metadados de episódio |
| `GET /api/animes/:id/episodes/:episodeId/source` | Resolve primeiro um embed oficial e depois consulta Consumet |
| `GET /api/history` | Histórico do perfil enviado no cabeçalho `x-profile-id` |
| `POST /api/history/progress` | Grava progresso validado |
| `GET /api/cache/stats` | Contadores do cache; em produção requer `x-cache-admin` igual a `CACHE_ADMIN_KEY` |

## Configuração

Veja `.env.example` para porta, origem do front-end, banco SQLite, URL Redis, endereços do Jikan e Consumet, provedor de anime Consumet, timeouts, TTLs e rate limit. O banco é criado automaticamente no caminho `DATABASE_PATH` (por padrão `backend/data/anifoda.sqlite` quando iniciado na pasta do backend; usando os scripts da raiz, `./data/anifoda.sqlite`).

Para trocar o provedor de catálogo, implemente os métodos equivalentes em `backend/src/providers/jikan.ts` e mantenha a API interna estável. Um provedor de vídeo futuro deve retornar apenas fontes autorizadas, validar protocolo e origem no backend e ser configurado separadamente dos metadados.

### Consumet

O backend consulta a busca, os detalhes/episódios e as fontes de reprodução da instância Consumet configurada. Ao clicar em um episódio, o AnimeVerse procura o título no provedor configurado, exige correspondência de título, localiza o mesmo número de episódio e escolhe uma fonte HTTPS, priorizando MP4 e qualidade. O player suporta MP4 e HLS nativo do navegador; o suporte HLS varia entre navegadores. Configure `CONSUMET_ENABLED`, `CONSUMET_BASE_URL`, `CONSUMET_ANIME_PROVIDER` e `CONSUMET_TIMEOUT_MS` no `.env`. `GET /api/providers` informa a configuração; não faz uma chamada de saúde ao serviço externo. O adaptador fica desligado automaticamente em testes para não fazer requisições externas.

## Verificação

```sh
npm test
npm run build
```

Os testes existentes exercitam deduplicação e fallback do cache. A API externa não é chamada pelos testes.
