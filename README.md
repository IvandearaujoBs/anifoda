# AnimeVerse

Catálogo responsivo de animes com metadados reais da [API Kitsu](https://kitsu.docs.apiary.io/), sem chave. Jikan permanece disponível como alternativa configurável. O projeto separa front-end Vite/TypeScript e API Express/TypeScript.

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
- Detalhes, sinopse, gêneros, classificação, estúdios e lista paginada de episódios, conforme disponíveis no provedor selecionado.
- Perfil local anônimo enviado pela interface e endpoints de histórico/progresso persistidos em SQLite. Sem um player ativo, a interface só exibe um progresso se já tiver sido enviado ao endpoint; o perfil não sincroniza entre dispositivos.
- Cache em memória com TTL, deduplicação de chamadas simultâneas, fallback para cópia expirada após falha do provedor e Redis opcional.
- Reprodução por embed oficial do YouTube quando disponível; adaptador de reprodução configurável para HiAnime, Consumet ou nenhum provedor.

## API interna

Todos os endpoints usam JSON. Respostas de catálogo colocam os dados em `data` e a paginação do provedor em `pagination`.

| Método e caminho | Uso |
| --- | --- |
| `GET /api/health` | Estado da API |
| `GET /api/providers` | Estado dos provedores de reprodução e prontidão do adaptador HiAnime |
| `GET /api/animes/popular?page=1` | Títulos populares |
| `GET /api/animes/season?page=1` | Títulos da temporada atual |
| `GET /api/animes/search?q=...&page=1&genre=&type=&status=` | Busca e filtros |
| `GET /api/animes/genres` | Gêneros |
| `GET /api/animes/:id` | Detalhes |
| `GET /api/animes/:id/seasons` | Informa que a fonte não fornece temporadas confiáveis |
| `GET /api/animes/:id/episodes?page=1` | Episódios publicados pela fonte |
| `GET /api/animes/:id/episodes/:episodeId` | Metadados de episódio |
| `GET /api/animes/:id/episodes/:episodeId/source` | Resolve primeiro um embed oficial e depois consulta o provedor de reprodução selecionado |
| `GET /api/history` | Histórico do perfil enviado no cabeçalho `x-profile-id` |
| `POST /api/history/progress` | Grava progresso validado |
| `GET /api/cache/stats` | Contadores do cache; em produção requer `x-cache-admin` igual a `CACHE_ADMIN_KEY` |

## Configuração

Veja `.env.example` para porta, origem do front-end, banco SQLite, URL Redis, seleção do catálogo (`CATALOG_PROVIDER=kitsu` por padrão), seleção do provedor de reprodução (`PLAYBACK_PROVIDER=hianime` por padrão), URLs e timeouts. O banco é criado automaticamente no caminho `DATABASE_PATH` (por padrão `backend/data/anifoda.sqlite` quando iniciado na pasta do backend; usando os scripts da raiz, `./data/anifoda.sqlite`).

O catálogo usa Kitsu por padrão; seu caminho da API é normalizado para `/api/edge` inclusive se `KITSU_BASE_URL` estiver configurado apenas como `https://kitsu.io`. Para voltar ao Jikan, ajuste `CATALOG_PROVIDER=jikan`. O catálogo permanece desacoplado do provedor de reprodução.

### Provedor de reprodução HiAnime

O backend está preparado para selecionar o adaptador HiAnime, mas ainda não consulta uma rota de vídeo: a documentação do projeto consultado descreve catálogo, detalhes e episódios e não especifica um resolvedor de fonte. Assim, nenhum endpoint de reprodução foi presumido ou inventado. Configure `PLAYBACK_PROVIDER=hianime` e `HIANIME_API_BASE_URL` com a URL base da sua instância. Quando tiver a rota licenciada, conecte a chamada e valide a resposta em `backend/src/providers/hianime.ts`; a assinatura comum está em `backend/src/providers/playback.ts`. Até essa conexão ser implementada, a API informa que o adaptador está aguardando o resolvedor.

Para continuar usando a integração Consumet existente, selecione `PLAYBACK_PROVIDER=consumet` e configure `CONSUMET_ENABLED=true`, `CONSUMET_BASE_URL`, `CONSUMET_ANIME_PROVIDER` e `CONSUMET_TIMEOUT_MS`. Para desativar provedores externos de reprodução, use `PLAYBACK_PROVIDER=none`. `GET /api/providers` mostra qual está selecionado e o status de configuração, sem expor a URL privada.

## Verificação

```sh
npm test
npm run build
```

Os testes existentes exercitam deduplicação e fallback do cache. A API externa não é chamada pelos testes.
