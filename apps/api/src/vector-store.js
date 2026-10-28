import { createHash } from 'node:crypto';
import { cosine } from '@rag/core/retrieval';
import { requestJson } from './providers.js';

/** Exact disk-backed retrieval is simple, inspectable, O(N × dimensions), and intended for small corpora. */
export class DiskVectorStore {
  async sync() {}
  async search(snapshot, vector, limit, threshold) {
    return snapshot.chunks
      .map((chunk) => ({ ...chunk, score: cosine(vector, chunk.vector) }))
      .filter((hit) => hit.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

/** Qdrant uses an ANN index. Snapshot filtering prevents deleted/old chunks from reappearing. */
export class QdrantVectorStore {
  constructor(config) {
    this.config = config;
  }
  collection(snapshot) {
    return (
      'rag_' +
      createHash('sha256').update(snapshot.signature).digest('hex').slice(0, 16) +
      '_' +
      snapshot.chunks[0].vector.length
    );
  }
  headers() {
    return {
      'Content-Type': 'application/json',
      ...(this.config.qdrantKey ? { 'api-key': this.config.qdrantKey } : {}),
    };
  }
  async call(snapshot, path, method, body) {
    return requestJson(`${this.config.qdrantUrl}/collections/${this.collection(snapshot)}${path}`, {
      method,
      headers: this.headers(),
      body: JSON.stringify(body),
    });
  }
  async sync(snapshot) {
    if (!snapshot.chunks.length) return;
    // Qdrant's collection-existence endpoint avoids treating other upstream failures as a missing index.
    const exists = await this.call(snapshot, '/exists', 'GET');
    if (!exists.result.exists)
      await this.call(snapshot, '', 'PUT', {
        vectors: { size: snapshot.chunks[0].vector.length, distance: 'Cosine' },
      });
    for (let start = 0; start < snapshot.chunks.length; start += 64) {
      await this.call(snapshot, '/points?wait=true', 'PUT', {
        points: snapshot.chunks
          .slice(start, start + 64)
          .map((c) => ({ id: c.id, vector: c.vector, payload: { snapshotId: snapshot.id } })),
      });
    }
  }
  async search(snapshot, vector, limit, threshold) {
    if (!snapshot.chunks.length) return [];
    const response = await this.call(snapshot, '/points/query', 'POST', {
      query: vector,
      limit,
      score_threshold: threshold,
      filter: { must: [{ key: 'snapshotId', match: { value: snapshot.id } }] },
      with_payload: false,
    });
    const byId = new Map(snapshot.chunks.map((c) => [c.id, c]));
    return response.result.points
      .filter((point) => byId.has(point.id))
      .map((point) => ({ ...byId.get(point.id), score: point.score }));
  }
}
