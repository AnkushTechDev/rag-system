import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
test('CLI preparation and plan work without Python; changed data fails verification', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'fine-tuning-cli-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const prepare = spawnSync(
    process.execPath,
    ['scripts/fine-tuning/prepare.js', '--output', output],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(prepare.status, 0, prepare.stderr);
  const report = JSON.parse(prepare.stdout.split('\nNext:')[0]);
  const manifest = JSON.parse(await readFile(join(report.directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.counts.train, 24);
  const plan = spawnSync(
    process.execPath,
    ['scripts/fine-tuning/train.js', '--run', report.directory],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(plan.status, 0, plan.stderr);
  const parsed = JSON.parse(plan.stdout);
  assert.equal(parsed.state, 'plan_only');
  assert.ok(parsed.args.includes('--mask-prompt'));
  assert.equal(existsSync(parsed.adapter), false, 'Plan must not create fake adapter artifacts');
  await appendFile(join(report.directory, 'train.jsonl'), '\n');
  const changed = spawnSync(
    process.execPath,
    ['scripts/fine-tuning/train.js', '--run', report.directory],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /Dataset changed/);
});
