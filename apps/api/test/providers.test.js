import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelProvider } from '../src/providers.js';
import { QdrantVectorStore } from '../src/vector-store.js';

test('OpenAI adapter preserves embedding ordering and sends a strict JSON schema', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json(
      url.endsWith('/embeddings')
        ? {
            data: [
              { index: 1, embedding: [0, 1] },
              { index: 0, embedding: [1, 0] },
            ],
          }
        : {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: 'A fact [S1]',
                    supported: true,
                    citations: ['S1'],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8 },
          },
    );
  });
  const provider = new ModelProvider({
    provider: 'openai',
    embeddingModel: 'test-embedding',
    chatModel: 'test-chat',
    openaiKey: 'test-not-a-secret',
  });
  assert.deepEqual(await provider.embed(['one', 'two']), [
    [1, 0],
    [0, 1],
  ]);
  const result = await provider.generate('question', {
    text: 'evidence',
    sources: [{ label: 'S1' }],
  });
  assert.equal(result.output.supported, true);
  assert.equal(calls[1].body.response_format.json_schema.strict, true);
});
test('Ollama adapter disables truncation and requires structured nonstreaming output', async (t) => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json(
      url.endsWith('/embed')
        ? { embeddings: [[1, 0]] }
        : {
            message: {
              content: JSON.stringify({
                answer: 'A fact [S1]',
                supported: true,
                citations: ['S1'],
              }),
            },
            prompt_eval_count: 5,
            eval_count: 7,
          },
    );
  });
  const provider = new ModelProvider({
    provider: 'ollama',
    ollamaUrl: 'http://ollama.test',
    embeddingModel: 'embed',
    chatModel: 'chat',
  });
  await provider.embed(['text']);
  const result = await provider.generate('question', { text: 'evidence' });
  assert.equal(bodies[0].truncate, false);
  assert.equal(bodies[1].stream, false);
  assert.equal(result.usage.outputTokens, 7);
});
test('provider failure is explicit, not silently replaced with demo text', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('provider failure', { status: 429 }));
  const provider = new ModelProvider({
    provider: 'ollama',
    ollamaUrl: 'http://ollama.test',
    embeddingModel: 'embed',
  });
  await assert.rejects(
    () => provider.embed(['text']),
    (error) => error.code === 'UPSTREAM_ERROR',
  );
});
test('Qdrant adapter creates a collection, versions points, and filters searches by snapshot', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    return Response.json(
      url.endsWith('/exists')
        ? { result: { exists: false } }
        : url.endsWith('/query')
          ? { result: { points: [{ id: 'point-1', score: 0.9 }] } }
          : { result: true },
    );
  });
  const store = new QdrantVectorStore({ qdrantUrl: 'http://qdrant.test' });
  const snapshot = {
    id: 'revision-1',
    signature: 'test-model',
    chunks: [{ id: 'point-1', text: 'passage', vector: [1, 0] }],
  };
  await store.sync(snapshot);
  const hits = await store.search(snapshot, [1, 0], 5, 0.3);
  assert.equal(calls[1].body.vectors.distance, 'Cosine');
  assert.equal(calls[2].body.points[0].payload.snapshotId, 'revision-1');
  assert.equal(calls[3].body.filter.must[0].match.value, 'revision-1');
  assert.equal(hits[0].score, 0.9);
});
