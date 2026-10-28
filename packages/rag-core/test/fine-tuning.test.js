import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareDataset } from '../src/fine-tuning.js';
const sample = await readFile(
  new URL('../../../fixtures/fine-tuning/support-triage.jsonl', import.meta.url),
  'utf8',
);
const rows = sample.trim().split('\n').map(JSON.parse);
const encode = (records) => records.map((row) => JSON.stringify(row)).join('\n');

test('sample yields real disjoint chat files and strips grouping metadata', () => {
  const result = prepareDataset(sample);
  assert.equal(result.valid, true);
  assert.deepEqual(result.counts, { train: 24, valid: 4, test: 4 });
  const groupByQuestion = new Map(rows.map((row) => [row.messages[1].content, row.group]));
  const seen = new Map();
  for (const [name, text] of Object.entries(result.files))
    for (const line of text.trim().split('\n')) {
      const record = JSON.parse(line);
      assert.deepEqual(Object.keys(record), ['messages']);
      const group = groupByQuestion.get(record.messages[1].content);
      if (seen.has(group))
        assert.equal(seen.get(group), name, 'Scenario leakage between partitions');
      seen.set(group, name);
    }
  assert.equal(seen.size, 16);
});
test('split is reproducible after input reordering and changes with a different seed', () => {
  assert.equal(
    prepareDataset(sample).fingerprint,
    prepareDataset(encode([...rows].reverse())).fingerprint,
  );
  assert.notEqual(
    prepareDataset(sample).fingerprint,
    prepareDataset(sample, { seed: 'another' }).fingerprint,
  );
});
test('invalid JSON and invalid message roles are reported with line numbers', () => {
  const invalid = structuredClone(rows);
  invalid[0].messages[2].role = 'user';
  assert.ok(prepareDataset(encode(invalid)).errors.some((error) => error.includes('Line 1')));
  assert.ok(prepareDataset('{oops').errors.some((error) => error.includes('invalid JSON')));
});
test('duplicate examples are removed and conflicting targets are rejected', () => {
  const duplicate = prepareDataset(sample + JSON.stringify(rows[0]) + '\n');
  assert.equal(duplicate.valid, true);
  assert.equal(duplicate.duplicates, 1);
  const conflict = structuredClone(rows[0]);
  conflict.messages[2].content = 'A contradictory target';
  assert.ok(
    prepareDataset(sample + JSON.stringify(conflict)).errors.some((error) =>
      error.includes('conflicting'),
    ),
  );
});
test('overlapping manual groups and duplicate prompts are merged independent of line order', () => {
  const records = structuredClone(rows);
  records.push({ ...structuredClone(rows[0]), group: rows[2].group });
  const a = prepareDataset(encode(records)),
    b = prepareDataset(encode([...records].reverse()));
  assert.equal(a.valid, true);
  assert.equal(a.groupCount, 15);
  assert.equal(a.fingerprint, b.fingerprint);
});
test('tiny or single-scenario datasets cannot masquerade as valid training splits', () => {
  assert.equal(prepareDataset(encode(rows.slice(0, 5))).valid, false);
  assert.equal(
    prepareDataset(encode(rows.map((row) => ({ ...row, group: 'same-scenario' })))).valid,
    false,
  );
  assert.equal(prepareDataset('x'.repeat(180001)).valid, false);
});
