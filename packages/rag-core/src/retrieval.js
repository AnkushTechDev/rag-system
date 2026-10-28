// These pure functions have no network/database dependency, making ranking easy to test.
const STOP_WORDS = new Set(
  'a an and are as at be by can do does for from how i in is it of on or that the this to was what when where which why with would'.split(
    ' ',
  ),
);

/** Unicode-aware tokenization; no stemming, synonym expansion, or multilingual stop lists. */
export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (word) => word.length > 1 && !STOP_WORDS.has(word),
  );
}

/** BM25: rare query terms count more, repetitions saturate, and document length is normalized. */
export function bm25(query, chunks, { k1 = 1.5, b = 0.75 } = {}) {
  if (!chunks.length) return [];
  const corpus = chunks.map((c) => tokenize(c.text));
  const terms = [...new Set(tokenize(query))];
  const averageLength = corpus.reduce((sum, tokens) => sum + tokens.length, 0) / corpus.length || 1;
  const frequencies = new Map(
    terms.map((term) => [term, corpus.filter((tokens) => tokens.includes(term)).length]),
  );
  return chunks
    .map((chunk, index) => {
      const tokens = corpus[index];
      const score = terms.reduce((sum, term) => {
        const tf = tokens.filter((token) => token === term).length;
        const df = frequencies.get(term);
        const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
        return (
          sum + (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * tokens.length) / averageLength))
        );
      }, 0);
      return { ...chunk, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Exact cosine similarity. A dimension mismatch is a bug, never silently zero-filled. */
export function cosine(a, b) {
  if (!a.length || a.length !== b.length || ![...a, ...b].every(Number.isFinite))
    throw new RangeError('Vectors must have equal, nonzero dimensions and finite values.');
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

/** RRF combines ranks, avoiding the incompatible raw scales of BM25 and cosine. */
export function reciprocalRankFusion(rankings, k = 60) {
  const combined = new Map();
  rankings.forEach((list) =>
    list.forEach((hit, index) => {
      const current = combined.get(hit.id) || { ...hit, score: 0, ranks: [] };
      current.score += 1 / (k + index + 1);
      current.ranks.push(index + 1);
      combined.set(hit.id, current);
    }),
  );
  return [...combined.values()].sort((a, b) => b.score - a.score);
}

function jaccard(a, b) {
  const left = new Set(tokenize(a)),
    right = new Set(tokenize(b));
  const intersection = [...left].filter((x) => right.has(x)).length;
  return intersection / (new Set([...left, ...right]).size || 1);
}

/**
 * MMR-style diversification: balance relevance against redundancy with already selected hits.
 * This is not a cross-encoder reranker. Disk/live uses cosine redundancy; demo uses Jaccard.
 */
export function diversify(candidates, topK, lambda = 0.75) {
  const pool = [...candidates],
    selected = [];
  const maxScore = Math.max(...pool.map((c) => c.score), 1e-9);
  while (pool.length && selected.length < topK) {
    let bestIndex = 0,
      bestScore = -Infinity;
    pool.forEach((candidate, index) => {
      const redundancy = selected.length
        ? Math.max(
            ...selected.map((previous) =>
              candidate.vector && previous.vector
                ? Math.max(0, cosine(candidate.vector, previous.vector))
                : jaccard(candidate.text, previous.text),
            ),
          )
        : 0;
      const mmr = (lambda * candidate.score) / maxScore - (1 - lambda) * redundancy;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIndex = index;
      }
    });
    selected.push(...pool.splice(bestIndex, 1));
  }
  return selected;
}
