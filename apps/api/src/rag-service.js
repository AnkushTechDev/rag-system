import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { chunkText, normalizeText } from '@rag/core/chunking';
import { bm25, reciprocalRankFusion, diversify } from '@rag/core/retrieval';
import { buildContext, validateCitations } from '@rag/core/context';
import { seedDocuments } from './seeds.js';
import evaluationCases from '../../../fixtures/evaluation.json' with { type: 'json' };
import { retrievalMetrics } from '@rag/core/evaluation';
import { Answer } from './providers.js';
import { AppError } from './errors.js';
const hash = (text) => createHash('sha256').update(text).digest('hex');

/** Application layer: composes pure algorithms, persistence, models, and vector-store ports. */
export class RagService {
  constructor({ repository, provider, vectorStore, config }) {
    this.repository = repository;
    this.provider = provider;
    this.vectorStore = vectorStore;
    this.config = config;
  }
  async initialize() {
    const current = await this.repository.load();
    if (!current || current.signature !== this.provider.signature) {
      await this.repository.transaction(async (old) =>
        this.buildIndex(
          old?.documents ||
            seedDocuments.map((d) => ({
              id: randomUUID(),
              ...d,
              createdAt: new Date().toISOString(),
              chunkSize: 700,
              overlap: 120,
            })),
          old,
        ),
      );
    } else {
      await this.vectorStore.sync(current); // Reconcile a restarted vector service before accepting traffic.
    }
  }
  /** Build a complete immutable snapshot before publishing it to readers. */
  async buildIndex(documents, old) {
    const snapshot = {
      schemaVersion: 1,
      id: randomUUID(),
      signature: this.provider.signature,
      createdAt: new Date().toISOString(),
      documents,
      chunks: [],
    };
    const reusable =
      old?.signature === this.provider.signature
        ? new Map(old.chunks.map((c) => [hash(c.text), c.vector]))
        : new Map();
    for (const document of documents) {
      const chunks = chunkText(document.content, {
        size: document.chunkSize,
        overlap: document.overlap,
      });
      for (const chunk of chunks)
        snapshot.chunks.push({
          ...chunk,
          id: randomUUID(),
          documentId: document.id,
          title: document.title,
          vector: reusable.get(hash(chunk.text)) || null,
        });
    }
    if (snapshot.chunks.length > 800)
      throw new AppError(
        422,
        'INDEX_LIMIT',
        'This learning workspace supports at most 800 chunks. Use fewer documents or larger chunks.',
      );
    const missing = snapshot.chunks.filter((c) => !c.vector);
    const vectors = await this.provider.embed(missing.map((c) => c.text));
    missing.forEach((chunk, index) => {
      chunk.vector = vectors[index];
    });
    if (
      this.provider.live &&
      snapshot.chunks.some((c) => c.vector.length !== snapshot.chunks[0].vector.length)
    )
      throw new AppError(
        422,
        'MODEL_CHANGED',
        'Embedding dimensions changed. Use the reindex endpoint to rebuild the corpus.',
      );
    // Remote points are versioned by snapshot, so an in-flight old query sees its old index.
    // Failed publication can leave orphan remote snapshots; cleanup is an explicit production concern.
    await this.vectorStore.sync(snapshot);
    return snapshot;
  }
  documents() {
    const snapshot = this.repository.snapshot();
    return snapshot.documents.map(({ content, ...doc }) => ({
      ...doc,
      characters: content.length,
      chunks: snapshot.chunks.filter((c) => c.documentId === doc.id).length,
    }));
  }
  document(id) {
    const snapshot = this.repository.snapshot();
    const document = snapshot.documents.find((doc) => doc.id === id);
    if (!document) throw new AppError(404, 'NOT_FOUND', 'Document not found.');
    return {
      ...document,
      chunks: snapshot.chunks
        .filter((c) => c.documentId === id)
        .map(({ vector, ...chunk }) => chunk),
    };
  }
  async ingest(input) {
    const content = normalizeText(input.content);
    if (content.length < 30)
      throw new AppError(
        400,
        'INVALID_DOCUMENT',
        'Normalized document content must contain at least 30 characters.',
      );
    let addedId;
    await this.repository.transaction(async (current) => {
      if (current.documents.some((doc) => hash(doc.content) === hash(content)))
        throw new AppError(409, 'DUPLICATE_DOCUMENT', 'This document content is already indexed.');
      if (
        current.documents.length >= 50 ||
        current.documents.reduce((n, d) => n + d.content.length, 0) + content.length > 200000
      )
        throw new AppError(
          422,
          'CORPUS_LIMIT',
          'Learning workspace limit: 50 documents or 200,000 total characters.',
        );
      addedId = randomUUID();
      return this.buildIndex(
        [
          ...current.documents,
          { ...input, content, id: addedId, createdAt: new Date().toISOString() },
        ],
        current,
      );
    });
    return this.documents().find((doc) => doc.id === addedId);
  }
  async reindex(settings) {
    await this.repository.transaction((current) =>
      this.buildIndex(
        current.documents.map((doc) => ({ ...doc, ...settings })),
        current,
      ),
    );
    return this.status();
  }
  status() {
    const snapshot = this.repository.snapshot();
    return {
      provider: this.config.provider,
      live: this.provider.live,
      chatModel: this.provider.live ? this.config.chatModel : null,
      embeddingModel: this.provider.live ? this.config.embeddingModel : null,
      vectorStore: this.config.vectorStore,
      indexId: snapshot.id,
      documents: snapshot.documents.length,
      chunks: snapshot.chunks.length,
      dimensions: snapshot.chunks[0]?.vector?.length || 0,
      minSimilarity: this.config.minSimilarity,
    };
  }
  evaluate() {
    const snapshot = this.repository.snapshot();
    const rows = evaluationCases.map((item) => {
      const retrieved = bm25(item.question, snapshot.chunks).map((c) => c.title);
      return {
        ...item,
        ...retrievalMetrics(retrieved, item.relevant, 3),
        retrieved: [...new Set(retrieved)].slice(0, 3),
      };
    });
    const mean = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
    return {
      indexId: snapshot.id,
      retriever: 'BM25',
      k: 3,
      recall: mean('recall'),
      mrr: mean('reciprocalRank'),
      ndcg: mean('ndcg'),
      rows,
    };
  }
  async query(input, signal) {
    const started = performance.now();
    // Capture ONE snapshot: ingestion cannot mix old sources with newly published vectors.
    const snapshot = this.repository.snapshot();
    const trace = [];
    async function stage(name, description, task) {
      const start = performance.now();
      const value = await task();
      trace.push({ name, description, durationMs: Number((performance.now() - start).toFixed(2)) });
      return value;
    }
    if (!this.provider.live && input.mode !== 'lexical')
      throw new AppError(
        422,
        'LIVE_MODE_REQUIRED',
        'Dense and hybrid retrieval require a real embedding provider. Use lexical mode in the demo.',
      );
    let lexical = [],
      dense = [];
    if (input.mode !== 'dense')
      lexical = await stage(
        'Lexical retrieval',
        'BM25: term rarity, frequency saturation, and length normalization.',
        () => bm25(input.question, snapshot.chunks).slice(0, 20),
      );
    if (input.mode !== 'lexical' && snapshot.chunks.length) {
      const [queryVector] = await stage(
        'Query embedding',
        `Embed using the same ${this.config.embeddingModel} model as the documents.`,
        () => this.provider.embed([input.question], signal),
      );
      dense = await stage(
        'Dense retrieval',
        `Cosine similarity via ${this.config.vectorStore}; threshold ${this.config.minSimilarity}.`,
        () => this.vectorStore.search(snapshot, queryVector, 20, this.config.minSimilarity),
      );
    }
    const candidates = await stage(
      'Rank candidates',
      input.mode === 'hybrid'
        ? 'Reciprocal rank fusion combines ranks, not raw score scales.'
        : 'Keep the selected retriever’s score ordering.',
      () =>
        input.mode === 'hybrid'
          ? reciprocalRankFusion([lexical, dense])
          : input.mode === 'dense'
            ? dense
            : lexical,
    );
    const selected = await stage(
      'Select context',
      input.diversify
        ? 'MMR-style diversification reduces duplicate evidence.'
        : 'Select the first k candidates without diversification.',
      () => (input.diversify ? diversify(candidates, input.topK) : candidates.slice(0, input.topK)),
    );
    const context = await stage(
      'Build prompt context',
      'Pack complete chunks into a bounded character budget and assign source labels.',
      () => buildContext(selected, input.contextBudget),
    );
    let output,
      usage = null;
    if (!context.sources.length) {
      output = {
        answer:
          'I could not find usable evidence for this question in the current knowledge base. Add a relevant document or ask a more specific question.',
        supported: false,
        citations: [],
      };
      trace.push({
        name: 'Abstain',
        description: 'No evidence fits the context. No generation call was made.',
        durationMs: 0,
      });
    } else {
      const generated = await stage(
        'Generate answer',
        this.provider.live
          ? 'Generate structured JSON grounded in the selected evidence.'
          : 'Demo: show retrieved extracts only. No LLM or embedding calls.',
        () => this.provider.generate(input.question, context, signal),
      );
      output = Answer.parse(generated.output);
      usage = generated.usage;
    }
    const citationCheck = await stage(
      'Validate references',
      'Verify cited labels, not factual entailment.',
      () => {
        try {
          return validateCitations(output, context.sources);
        } catch {
          throw new AppError(
            502,
            'INVALID_CITATIONS',
            'The generated answer had invalid source references. Please retry.',
          );
        }
      },
    );
    return {
      id: randomUUID(),
      indexId: snapshot.id,
      question: input.question,
      mode: input.mode,
      provider: this.config.provider,
      answer: output,
      usage,
      citationCheck,
      sources: context.sources,
      candidates: candidates.slice(0, 20).map(({ vector, ...hit }) => hit),
      trace,
      stats: {
        durationMs: Math.round(performance.now() - started),
        candidateCount: candidates.length,
        selectedCount: context.sources.length,
        contextCharacters: context.characters,
        approximateContextTokens: Math.ceil(context.characters / 4),
      },
      settings: input,
    };
  }
}
