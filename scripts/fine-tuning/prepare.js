// Offline preparation: examples stay local and this command never downloads a model.
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { prepareDataset } from '@rag/core/fine-tuning';
const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    seed: { type: 'string', default: '42' },
    output: { type: 'string' },
  },
});
const root = resolve(import.meta.dirname, '../..');
const input = resolve(values.input || resolve(root, 'fixtures/fine-tuning/support-triage.jsonl'));
const report = prepareDataset(await readFile(input, 'utf8'), { seed: values.seed });
if (!report.valid) {
  console.error(report.errors.join('\n'));
  process.exitCode = 1;
} else {
  const directory = resolve(values.output || resolve(root, 'data/fine-tuning'), randomUUID());
  await mkdir(directory, { recursive: true });
  const digests = {};
  for (const [name, text] of Object.entries(report.files)) {
    await writeFile(resolve(directory, name), text);
    digests[name] = createHash('sha256').update(text).digest('hex');
  }
  const { files, ...summary } = report;
  await writeFile(
    resolve(directory, 'manifest.json'),
    JSON.stringify({ ...summary, digests, createdAt: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify({ directory, ...summary }, null, 2));
  console.log(`Next: npm run finetune:train -- --run ${directory}`);
}
