/** Evaluate document-level retrieval. Relevant labels are document titles in our teaching fixtures. */
export function retrievalMetrics(retrieved, relevant, k = 5) {
  const actual = [...new Set(retrieved)].slice(0, k); // Multiple chunks from one doc count once.
  const expected = new Set(relevant);
  const rank = actual.findIndex((title) => expected.has(title));
  const matches = actual.filter((title) => expected.has(title)).length;
  const dcg = actual.reduce(
    (sum, title, i) => sum + (expected.has(title) ? 1 / Math.log2(i + 2) : 0),
    0,
  );
  const ideal = Array.from(
    { length: Math.min(k, expected.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((a, b) => a + b, 0);
  return {
    recall: expected.size ? matches / expected.size : 0,
    reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1),
    ndcg: ideal ? dcg / ideal : 0,
  };
}
