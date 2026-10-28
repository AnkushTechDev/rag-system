import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { bootstrap } from '../src/bootstrap.js';
import { readConfig } from '../src/config.js';

test('HTTP API validates input, ingests documents and returns a grounded query', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rag-http-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const config = readConfig({ RAG_PROVIDER: 'demo', RAG_DATA_FILE: join(dir, 'index.json') });
  const service = await bootstrap(config);
  const server = createApp(service).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path, data) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.ok(health.headers.get('x-request-id'));
  assert.equal((await post('/queries', { question: 'x' })).status, 400);
  assert.equal((await post('/documents', { title: 'Short', content: 'too short' })).status, 400);
  assert.equal((await post('/index/rebuild', { chunkSize: 100, overlap: 90 })).status, 400);
  assert.equal((await post('/queries', { question: 'vector search', mode: 'dense' })).status, 422);
  const result = await post('/queries', { question: 'What does BM25 measure?' });
  assert.equal(result.status, 200);
  assert.ok((await result.json()).sources.length);
  const content = 'Zebramarker is a unique phrase used by this HTTP integration test document.';
  const created = await post('/documents', { title: 'HTTP fixture', content });
  assert.equal(created.status, 201);
  const doc = await created.json();
  assert.equal((await fetch(base + `/documents/${doc.id}`)).status, 200);
  assert.equal((await post('/documents', { title: 'Duplicate', content })).status, 409);
  const evaluation = await (await fetch(base + '/evaluations')).json();
  assert.equal(evaluation.rows.length, 12);
  assert.ok(evaluation.recall >= 0 && evaluation.recall <= 1);
  assert.equal((await fetch(base + '/missing')).status, 404);
  const invalid = await fetch(base + '/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(invalid.status, 400);
});
