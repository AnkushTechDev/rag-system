// Offline, isolated retrieval regression set. Never calls a paid model or edits your knowledge base.
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap } from '../apps/api/src/bootstrap.js';
import { readConfig } from '../apps/api/src/config.js';
import { QueryInput } from '../apps/api/src/validation.js';
import { retrievalMetrics } from '@rag/core/evaluation';
const directory = await mkdtemp(join(tmpdir(), 'rag-eval-'));
try {
  const service = await bootstrap(
    readConfig({ RAG_PROVIDER: 'demo', RAG_DATA_FILE: join(directory, 'index.json') }),
  );
  const cases = JSON.parse(
    await readFile(new URL('../fixtures/evaluation.json', import.meta.url), 'utf8'),
  );
  const rows = [];
  for (const item of cases) {
    const result = await service.query(QueryInput.parse({ question: item.question, topK: 5 }));
    const retrieved = result.candidates.map((c) => c.title);
    rows.push({
      ...item,
      ...retrievalMetrics(retrieved, item.relevant, 3),
      retrieved: [...new Set(retrieved)].slice(0, 3),
    });
  }
  const mean = (key) =>
    Number((rows.reduce((sum, row) => sum + row[key], 0) / rows.length).toFixed(3));
  const summary = {
    dataset: '12 synthetic document-level teaching queries; not a held-out benchmark',
    retriever: 'BM25',
    k: 3,
    recall: mean('recall'),
    mrr: mean('reciprocalRank'),
    ndcg: mean('ndcg'),
    rows,
  };
  console.log(JSON.stringify(summary, null, 2));
  // A regression threshold, not a claim about production retrieval quality.
  if (summary.recall < 0.85) process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
