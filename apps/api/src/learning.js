export const interviewTopics = [
  {
    id: '01',
    title: 'Explain RAG end to end',
    level: 'FOUNDATION',
    question: 'Walk me through an ingestion pipeline and a query pipeline.',
    answer:
      'Ingest: parse → normalize → chunk → attach metadata → embed → index. Query: validate → retrieve → fuse/rerank → select bounded context → generate → verify references → evaluate. In this app query() takes an immutable index snapshot so concurrent ingestion cannot mix versions.',
    tradeoff:
      'RAG refreshes knowledge without retraining, but adds retrieval latency and introduces ingestion, access-control, and evaluation responsibilities.',
    code: 'apps/api/src/rag-service.js',
    exercise:
      'Run a query and match every trace stage to its function. Explain why RAG does not inherently require agents.',
  },
  {
    id: '02',
    title: 'Choose chunk size and overlap',
    level: 'FOUNDATION',
    question: 'What happens if chunks are too small or too large?',
    answer:
      'Small chunks can lose needed context. Large chunks can dilute relevance and waste context budget. Overlap preserves continuity but duplicates text and increases embedding/storage cost. Tune settings on representative questions.',
    tradeoff:
      'This implementation uses characters and boundary preferences. Token-based or semantic chunking needs extra logic and may be better for a particular corpus.',
    code: 'packages/rag-core/src/chunking.js',
    exercise:
      'Rebuild the index with 400/60 and 1000/150 character settings. Compare retrieval results and context size.',
  },
  {
    id: '03',
    title: 'Understand vectors and ANN',
    level: 'FOUNDATION',
    question: 'Why use the same embedding model for queries and documents?',
    answer:
      'Each model defines a vector space. Equal dimensions do not make vectors from different models comparable. Record the provider/model fingerprint and re-embed when it changes. Exact cosine search scans every vector; ANN indexes such as HNSW trade recall for speed.',
    tradeoff:
      'Disk vectors are easy to inspect at small scale. Qdrant adds operational complexity while enabling indexed search and metadata filtering.',
    code: 'apps/api/src/vector-store.js',
    exercise:
      'Read cosine() and explain its formula. Explain why cosine 0.8 is not 80% confidence.',
  },
  {
    id: '04',
    title: 'Compare BM25 and dense search',
    level: 'RETRIEVAL',
    question: 'When would BM25 outperform semantic search?',
    answer:
      'Exact identifiers, rare product names, and error codes often suit BM25. Dense search can match paraphrases and synonyms even with no shared words. Hybrid retrieval can cover both failure patterns.',
    tradeoff:
      'BM25 uses term rarity, saturating frequency, and length normalization. Its raw scores are not comparable to cosine similarity.',
    code: 'packages/rag-core/src/retrieval.js',
    exercise:
      'Search for an exact term and then a paraphrase. Explain demo-mode failures before enabling real embeddings.',
  },
  {
    id: '05',
    title: 'Fusion, reranking and diversity',
    level: 'RETRIEVAL',
    question: 'How do RRF, MMR, and a cross-encoder differ?',
    answer:
      'RRF combines ranking lists with reciprocal rank contributions. MMR selects relevant but less redundant chunks. A cross-encoder jointly scores a question and passage. This app implements RRF and MMR-style diversification, not a learned cross-encoder.',
    tradeoff:
      'Better ranking may require a larger candidate set, extra model calls, latency, and careful evaluation. More context is not always better.',
    code: 'packages/rag-core/src/retrieval.js',
    exercise:
      'Toggle diversification and inspect which near-duplicate chunks disappear. Compute RRF by hand on two short ranked lists.',
  },
  {
    id: '06',
    title: 'Control hallucination and injection',
    level: 'RELIABILITY',
    question: 'Does adding RAG eliminate hallucinations?',
    answer:
      'No. A model can ignore or misinterpret evidence. This app abstains when context is empty, requests grounded structured output, and rejects unknown reference labels. Reference integrity is weaker than factual entailment. Retrieved text may contain malicious instructions.',
    tradeoff:
      'Prompts are guidance, not a complete security boundary. Production systems also require authorization, restricted tools, safe rendering, and adversarial evaluation.',
    code: 'packages/rag-core/src/context.js',
    exercise:
      'Inspect cited passages yourself. Explain why a schema-valid answer with real citation IDs can still be wrong.',
  },
  {
    id: '07',
    title: 'Evaluate retrieval and generation',
    level: 'RELIABILITY',
    question: 'How would you measure whether your RAG app is improving?',
    answer:
      'Evaluate retrieval with recall@k, MRR, and nDCG against labelled relevant items. Evaluate generation with groundedness, usefulness, completeness, citation precision, and abstention accuracy. Measure latency, tokens, and cost separately.',
    tradeoff:
      'This app’s small synthetic fixture is a regression smoke set, not a held-out benchmark or enterprise quality claim. Do not optimize on the test set.',
    code: 'packages/rag-core/src/evaluation.js',
    exercise:
      'Add five hard questions with relevant-document labels and two no-answer questions. Identify one retrieval failure and one generation failure.',
  },
  {
    id: '08',
    title: 'Design a production RAG service',
    level: 'SYSTEM DESIGN',
    question: 'What changes for millions of documents and multiple tenants?',
    answer:
      'Add authentication and enforce document authorization before retrieval. Use durable metadata storage, ANN indexing, background ingestion queues, idempotency, incremental updates, retention/deletion, backups, load tests, and monitoring. Version models and indexes.',
    tradeoff:
      'The app is a modular monolith with one API process and local snapshots. Those deliberate teaching limits are simpler to inspect than distributed infrastructure.',
    code: 'apps/api/src/repository.js',
    exercise:
      'Sketch a scalable design. Include tenant filters, queue retries, index updates, cache invalidation, and a deletion workflow.',
  },
];
