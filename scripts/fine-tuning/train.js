import { parseArgs } from 'node:util';
import { readFile, access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    execute: { type: 'boolean', default: false },
    iters: { type: 'string', default: '60' },
  },
});
if (!values.run) throw new Error('Provide --run with a directory created by finetune:prepare.');
const root = resolve(import.meta.dirname, '../..'),
  directory = resolve(values.run);
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
for (const name of ['train.jsonl', 'valid.jsonl', 'test.jsonl']) {
  const digest = createHash('sha256')
    .update(await readFile(resolve(directory, name)))
    .digest('hex');
  if (digest !== manifest.digests[name])
    throw new Error(`Dataset changed: ${name}. Prepare a fresh version before training.`);
}
const iterations = Number(values.iters);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000)
  throw new Error('iters must be 1–1000.');
const python = process.env.FINETUNE_PYTHON || resolve(root, '.venv-finetune/bin/python');
const model = process.env.FINETUNE_MODEL || 'mlx-community/Qwen2.5-0.5B-Instruct-4bit';
const adapter = resolve(directory, 'adapters');
const args = [
  '-m',
  'mlx_lm',
  'lora',
  '--model',
  model,
  '--train',
  '--data',
  directory,
  '--adapter-path',
  adapter,
  '--fine-tune-type',
  'lora',
  '--iters',
  String(iterations),
  '--batch-size',
  '1',
  '--num-layers',
  '4',
  '--max-seq-length',
  '512',
  '--learning-rate',
  '0.0001',
  '--mask-prompt',
  '--seed',
  '42',
  '--steps-per-report',
  '10',
  '--steps-per-eval',
  '10',
  '--val-batches',
  '-1',
  '--save-every',
  '20',
];
// Default is a reviewable plan. --execute explicitly starts real MLX optimization.
console.log(
  JSON.stringify(
    {
      state: values.execute ? 'starting_real_training' : 'plan_only',
      python,
      args,
      counts: manifest.counts,
      datasetFingerprint: manifest.fingerprint,
      adapter,
    },
    null,
    2,
  ),
);
if (values.execute) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw new Error(
      'This MLX runner targets Apple Silicon macOS. Use a suitable trainer on other platforms.',
    );
  await access(python);
  try {
    await access(resolve(adapter, 'adapters.safetensors'));
    throw new Error('Adapter already exists. Prepare a fresh run instead of overwriting weights.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Exclusive claim prevents two CLI processes from writing into the same adapter run.
  await writeFile(
    resolve(directory, 'training-run.json'),
    JSON.stringify(
      {
        model,
        args,
        datasetFingerprint: manifest.fingerprint,
        startedAt: new Date().toISOString(),
        status: 'launched',
      },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  // No shell interpolation and no browser-controlled commands.
  const child = spawn(python, args, { cwd: root, stdio: 'inherit', shell: false });
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
