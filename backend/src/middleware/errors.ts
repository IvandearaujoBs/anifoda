import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errors: ErrorRequestHandler = (err, req, res, _next) => {
  const provider = String(err?.provider || (req.path.endsWith('/source') ? process.env.PLAYBACK_PROVIDER || 'none' : process.env.CATALOG_PROVIDER || 'jikan'));
  const providerName = provider === 'jikan' ? 'Jikan' : provider === 'kitsu' ? 'Kitsu' : 'Consumet';
  const upstreamStatus = Number(err?.status);
  const networkFailure = err?.name === 'TimeoutError' || err?.name === 'AbortError' || err?.cause?.code === 'ENOTFOUND' || err?.cause?.code === 'ECONNREFUSED' || /fetch failed|demorou para responder|tempo limite|não foi possível conectar/i.test(String(err?.message));
  const status = err instanceof ZodError ? 400 : upstreamStatus || (networkFailure ? 502 : 500);
  const message = err instanceof ZodError
    ? 'Parâmetros inválidos.'
    : networkFailure
      ? `Não foi possível conectar ao catálogo ${providerName}. Confira a conexão com a internet e tente novamente.`
      : provider === 'consumet' && /HTTP 451/.test(String(err?.message))
        ? 'A instância do Consumet recusou esta solicitação (HTTP 451). Configure CONSUMET_BASE_URL com a instância autorizada que você utiliza.'
        : upstreamStatus === 429
        ? `O catálogo ${providerName} está limitando as consultas. Aguarde um pouco e tente novamente.`
        : status === 404
          ? 'Anime ou informação não encontrado na fonte.'
          : 'Serviço temporariamente indisponível.';
  console.error(JSON.stringify({ level: 'error', status, provider, path: req.path, kind: networkFailure ? 'network' : 'request', detail: err?.message || 'Erro interno' }));
  res.status(status).json({ error: { message, status } });
};
