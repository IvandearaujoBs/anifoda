import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof ZodError ? 400 : Number(err?.status) || 500;
  const message = err instanceof ZodError ? 'Parâmetros inválidos.' : err?.message || 'Erro interno';
  console.error(JSON.stringify({ level: 'error', status, message }));
  res.status(status).json({ error: { message: status >= 500 ? 'Serviço temporariamente indisponível.' : message, status } });
};
