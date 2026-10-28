import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { registerFineTuning } from '../src/fine-tuning.js';
async function server(t, env = {}) {
  const app = express();
  app.use(express.json());
  registerFineTuning(app, env);
  app.use((error, _req, res, _next) =>
    res.status(error.status || 400).json({ error: { code: error.code, message: error.message } }),
  );
  const http = app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(() => new Promise((resolve) => http.close(resolve)));
  const url = `http://127.0.0.1:${http.address().port}`;
  return {
    url,
    post: (path, body) =>
      fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}
test('dataset endpoints prepare files locally and comparison requires explicit configuration', async (t) => {
  const api = await server(t);
  const sample = await (await fetch(api.url + '/api/fine-tuning')).json();
  assert.equal(sample.comparisonEnabled, false);
  assert.equal(sample.trainingStatus, 'external_training_not_tracked');
  const response = await api.post('/api/fine-tuning/prepare', { jsonl: sample.sample });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).valid, true);
  const bad = await api.post('/api/fine-tuning/prepare', { jsonl: '{broken' });
  assert.equal((await bad.json()).valid, false);
  const comparison = await api.post('/api/fine-tuning/compare', {
    question: 'A citation is missing',
  });
  assert.equal(comparison.status, 422);
});
test('comparison uses actual configured model responses and exposes format failures', async (t) => {
  const original = globalThis.fetch;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).startsWith('http://127.0.0.1:')) return original(url, init);
    requests.push({ url, body: JSON.parse(init.body) });
    return Response.json({
      choices: [
        {
          message: {
            content:
              requests.length === 1
                ? 'Malformed output'
                : JSON.stringify({ category: 'generation', next_step: 'Validate citations.' }),
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  });
  const api = await server(t, {
    FINETUNE_COMPARE_ENABLED: 'true',
    FINETUNE_BASE_URL: 'http://base.test/v1',
    FINETUNE_TUNED_URL: 'http://tuned.test/v1',
  });
  const response = await api.post('/api/fine-tuning/compare', {
    question: 'A source label is invalid',
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.base.schemaValid, false);
  assert.equal(result.tuned.schemaValid, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.messages[1].content, 'A source label is invalid');
  assert.equal(requests[0].url, 'http://base.test/v1/chat/completions');
});
