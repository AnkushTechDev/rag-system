import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, normalizeText } from '../src/chunking.js';
import { bm25, cosine, reciprocalRankFusion, diversify } from '../src/retrieval.js';
import { buildContext, validateCitations } from '../src/context.js';
import { retrievalMetrics } from '../src/evaluation.js';

test('normalization removes nulls and normalizes newlines', () =>
  assert.equal(normalizeText(' x\r\ny\u0000 '), 'x\ny'));
test('chunk offsets reconstruct normalized text and every character is covered', () => {
  const text = normalizeText(
    (
      'Paragraph one explains retrieval and context.\n\n' + 'Second paragraph explains embeddings. '
    ).repeat(20),
  );
  const chunks = chunkText(text, { size: 200, overlap: 30 });
  assert.ok(chunks.length > 2);
  assert.equal(chunks[0].start, 0);
  assert.equal(chunks.at(-1).end, text.length);
  chunks.forEach((chunk, i) => {
    assert.equal(text.slice(chunk.start, chunk.end), chunk.text);
    assert.ok(chunk.text.length <= 200);
    if (i) assert.ok(chunk.start <= chunks[i - 1].end && chunk.end > chunks[i - 1].end);
  });
});
test('splitter preserves emoji code points and terminates on unbroken text', () => {
  const text = '😀'.repeat(333);
  const chunks = chunkText(text, { size: 101, overlap: 17 });
  assert.equal(chunks.at(-1).end, text.length);
  assert.ok(
    chunks.every((c) => !c.text.includes('�') && Array.from(c.text).every((x) => x === '😀')),
  );
});
test('invalid overlap cannot cause an infinite chunking loop', () =>
  assert.throws(() => chunkText('x'.repeat(300), { size: 100, overlap: 100 }), RangeError));
test('BM25 rewards a rare matching term and ignores unrelated text', () => {
  const chunks = [
    { id: '1', text: 'retrieval retrieval vectors' },
    { id: '2', text: 'retrieval pineapples' },
    { id: '3', text: 'retrieval ordinary words' },
  ];
  assert.equal(bm25('pineapples', chunks)[0].id, '2');
  assert.deepEqual(bm25('quuxxyzz', chunks), []);
});
test('cosine measures direction and rejects incompatible vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.throws(() => cosine([1], [1, 2]), RangeError);
  assert.throws(() => cosine([NaN], [1]), RangeError);
});
test('RRF combines matching identifiers with exact reciprocal rank contributions', () => {
  const rows = reciprocalRankFusion([
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'a' }],
  ]);
  assert.equal(rows.length, 2);
  assert.ok(Math.abs(rows[0].score - (1 / 61 + 1 / 62)) < 1e-12);
});
test('diversification prefers nonduplicate evidence when relevance is equal', () => {
  const rows = diversify(
    [
      { id: 'a', text: 'alpha beta', score: 1 },
      { id: 'b', text: 'alpha beta', score: 1 },
      { id: 'c', text: 'delta gamma', score: 1 },
    ],
    2,
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'c'],
  );
});
test('context obeys budget and strips vectors', () => {
  const context = buildContext(
    [
      { id: 'a', title: 'Short', text: 'a'.repeat(100), start: 0, end: 100, vector: [1, 0] },
      { id: 'b', title: 'Long', text: 'b'.repeat(1000), start: 0, end: 1000 },
    ],
    300,
  );
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].label, 'S1');
  assert.ok(!('vector' in context.sources[0]));
  assert.ok(context.characters <= 300);
  assert.equal(context.characters, context.text.length + 2);
});
test('citation guard rejects invented labels and inconsistent inline markers', () => {
  const sources = [{ label: 'S1' }];
  assert.equal(
    validateCitations({ answer: 'A fact [S1]', supported: true, citations: ['S1'] }, sources).valid,
    true,
  );
  assert.throws(
    () => validateCitations({ answer: 'A fact [S2]', supported: true, citations: ['S2'] }, sources),
    /unknown source/,
  );
  assert.throws(
    () => validateCitations({ answer: 'No marker', supported: true, citations: ['S1'] }, sources),
    /inline|referenced/,
  );
  assert.throws(
    () => validateCitations({ answer: 'Unknown', supported: false, citations: ['S1'] }, sources),
    /unsupported/,
  );
});
test('metrics use document-level deduplication and known ranks', () => {
  const m = retrievalMetrics(['wrong', 'right', 'right'], ['right', 'missing'], 3);
  assert.equal(m.recall, 0.5);
  assert.equal(m.reciprocalRank, 0.5);
  assert.ok(m.ndcg > 0 && m.ndcg < 1);
});
