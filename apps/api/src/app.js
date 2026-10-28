import express from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { DocumentInput, QueryInput, ChunkSettings } from './validation.js';
import { interviewTopics } from './learning.js';

/** Composition is injected: HTTP integration tests can exercise the real app without listening on a port. */
export function createApp(service, { log = console.log } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', ...service.status() }));
  app.get('/api/documents', (_req, res) => res.json(service.documents()));
  app.get('/api/documents/:id', (req, res) => res.json(service.document(req.params.id)));
  app.post('/api/documents', async (req, res) =>
    res.status(201).json(await service.ingest(DocumentInput.parse(req.body))),
  );
  app.post('/api/index/rebuild', async (req, res) =>
    res.json(await service.reindex(ChunkSettings.parse(req.body))),
  );
  app.get('/api/evaluations', (_req, res) => res.json(service.evaluate()));
  app.get('/api/learn', (_req, res) => res.json(interviewTopics));
  // Small process-local concurrency limit. Not a distributed rate limiter or per-user quota.
  let active = 0;
  app.post('/api/queries', async (req, res) => {
    const input = QueryInput.parse(req.body);
    if (active >= 3)
      throw new AppError(429, 'BUSY', 'Three queries are already running. Try again shortly.');
    active += 1;
    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.on('close', onClose);
    try {
      res.json(
        await service.query(input, AbortSignal.any([abort.signal, AbortSignal.timeout(120000)])),
      );
    } finally {
      active -= 1;
      res.off('close', onClose);
    }
  });
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
  app.use((error, req, res, _next) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((issue) => issue.message).join(' '),
          requestId: req.id,
        },
      });
    if (error.type === 'entity.too.large')
      return res.status(413).json({
        error: {
          code: 'BODY_TOO_LARGE',
          message: 'Request body exceeds 256kb.',
          requestId: req.id,
        },
      });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
          requestId: req.id,
        },
      });
    if (error instanceof AppError)
      return res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, requestId: req.id } });
    // Avoid logging keys, full prompts, or full request bodies. Logs identify a failure by request ID.
    log(
      JSON.stringify({
        level: 'error',
        requestId: req.id,
        name: error.name,
        message: error.message,
      }),
    );
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request failed. Check the server log using the request ID.',
        requestId: req.id,
      },
    });
  });
  return app;
}
