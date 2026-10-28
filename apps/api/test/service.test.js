import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RagService } from '../src/rag-service.js';
import { IndexRepository } from '../src/repository.js';
import { DiskVectorStore } from '../src/vector-store.js';
import { ModelProvider } from '../src/providers.js';
import { QueryInput } from '../src/validation.js';

async function fixture(t, provider = new ModelProvider({ provider: 'demo' })) {
  const directory = await mkdtemp(join(tmpdir(), 'rag-service-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = {
    provider: provider.live ? 'test' : 'demo',
    vectorStore: 'disk',
    minSimilarity: 0.1,
    dataFile: join(directory, 'index.json'),
  };
  const repository = new IndexRepository(config.dataFile);
  const service = new RagService({
    repository,
    provider,
    vectorStore: new DiskVectorStore(),
    config,
  });
  await service.initialize();
  return { service, repository, config };
}
const query = (question, extra = {}) => QueryInput.parse({ question, ...extra });

test('ingestion persists chunks and duplicate content is rejected', async (t) => {
  const { service, config } = await fixture(t);
  const input = {
    title: 'New record',
    content: 'Jellyfish indexing is a unique test concept for document ingestion.',
    chunkSize: 500,
    overlap: 50,
  };
  const added = await service.ingest(input);
  assert.equal(added.chunks, 1);
  assert.equal(service.document(added.id).content, input.content);
  await assert.rejects(
    () => service.ingest(input),
    (error) => error.code === 'DUPLICATE_DOCUMENT',
  );
  assert.equal(JSON.parse(await readFile(config.dataFile, 'utf8')).documents.length, 7);
});
test('simultaneous writes are serialized without lost documents', async (t) => {
  const { service } = await fixture(t);
  await Promise.all(
    ['First', 'Second'].map((title) =>
      service.ingest({
        title,
        content: `${title} concurrent document contains enough characters for indexing.`,
        chunkSize: 500,
        overlap: 50,
      }),
    ),
  );
  assert.equal(service.documents().length, 8);
});
test('unsupported retrieval abstains without fabricating evidence', async (t) => {
  const { service } = await fixture(t);
  const result = await service.query(query('quuxxyzz plovertron'));
  assert.equal(result.answer.supported, false);
  assert.equal(result.sources.length, 0);
  assert.ok(result.trace.some((stage) => stage.name === 'Abstain'));
});
test('demo exposes real lexical trace, source offsets and valid citations without vectors', async (t) => {
  const { service } = await fixture(t);
  const result = await service.query(query('What is reciprocal rank fusion?'));
  assert.ok(result.answer.citations.length);
  assert.ok(result.sources.every((s) => !('vector' in s)));
  assert.ok(result.candidates.every((s) => !('vector' in s)));
  assert.equal(result.citationCheck.valid, true);
  assert.equal(result.provider, 'demo');
  assert.ok(result.trace.every((stage) => stage.durationMs >= 0));
});
test('demo cannot silently pretend to offer dense retrieval', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(
    () => service.query(query('vector search', { mode: 'dense' })),
    (error) => error.code === 'LIVE_MODE_REQUIRED',
  );
});
test('reindex publishes a new version with requested chunk settings', async (t) => {
  const { service } = await fixture(t);
  const old = service.status().indexId;
  await service.reindex({ chunkSize: 400, overlap: 40 });
  assert.notEqual(service.status().indexId, old);
  assert.ok(service.documents().every((d) => d.chunkSize === 400));
});
test('real-mode orchestration uses embedding cache, dense search, generation and citation checks', async (t) => {
  let embeddings = 0,
    generations = 0;
  const fake = {
    live: true,
    signature: 'test-model:v1',
    async embed(texts) {
      embeddings += texts.length;
      return texts.map(() => [1, 0, 0]);
    },
    async generate(_q, context) {
      generations++;
      return {
        output: {
          answer: `Grounded fixture [${context.sources[0].label}]`,
          supported: true,
          citations: [context.sources[0].label],
        },
        usage: { inputTokens: 42, outputTokens: 7 },
      };
    },
  };
  const { service, repository, config } = await fixture(t, fake);
  const originalCount = embeddings;
  const second = new RagService({
    repository: new IndexRepository(config.dataFile),
    provider: fake,
    vectorStore: new DiskVectorStore(),
    config,
  });
  await second.initialize();
  assert.equal(embeddings, originalCount, 'Restart must reuse persisted document vectors.');
  const result = await second.query(query('Explain RAG', { mode: 'hybrid' }));
  assert.equal(generations, 1);
  assert.equal(embeddings, originalCount + 1);
  assert.equal(result.usage.inputTokens, 42);
  assert.ok(result.trace.some((s) => s.name === 'Query embedding'));
  assert.ok(repository.snapshot().chunks.every((c) => c.vector.length === 3));
});
test('model-signature change rebuilds embeddings instead of mixing spaces', async (t) => {
  const { service, config } = await fixture(t);
  let embedded = 0;
  const provider = {
    live: true,
    signature: 'new-model',
    async embed(texts) {
      embedded += texts.length;
      return texts.map(() => [0, 1]);
    },
  };
  const next = new RagService({
    repository: new IndexRepository(config.dataFile),
    provider,
    vectorStore: new DiskVectorStore(),
    config,
  });
  await next.initialize();
  assert.ok(embedded > 0);
  assert.notEqual(next.status().indexId, service.status().indexId);
  assert.equal(next.status().dimensions, 2);
});

test('ingestion rejects content that becomes empty after normalization', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(
    () =>
      service.ingest({
        title: 'Invalid',
        content: '\u0000'.repeat(40),
        chunkSize: 700,
        overlap: 120,
      }),
    (error) => error.code === 'INVALID_DOCUMENT',
  );
});
