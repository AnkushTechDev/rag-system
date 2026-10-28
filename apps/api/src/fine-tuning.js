import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { prepareDataset } from '@rag/core/fine-tuning';
import { AppError } from './errors.js';
import { requestJson } from './providers.js';
export const SYSTEM_PROMPT =
  'Classify the RAG support issue. Return only JSON with category (chunking, retrieval, generation, or operations) and next_step (one concise debugging action).';
const Input = z.object({
  jsonl: z.string().max(180000),
  seed: z.string().trim().min(1).max(40).default('42'),
});
const Comparison = z.object({
  question: z.string().trim().min(3).max(2000),
  system: z.string().trim().min(1).max(6000).default(SYSTEM_PROMPT),
});

/** Dataset preparation is local and never launches training or uploads examples. */
export function registerFineTuning(app, env = process.env) {
  app.get('/api/fine-tuning', async (_req, res) =>
    res.json({
      sample: await readFile(
        new URL('../../../fixtures/fine-tuning/support-triage.jsonl', import.meta.url),
        'utf8',
      ),
      system: SYSTEM_PROMPT,
      trainingStatus: 'external_training_not_tracked',
      comparisonEnabled: env.FINETUNE_COMPARE_ENABLED === 'true',
    }),
  );
  app.post('/api/fine-tuning/prepare', (req, res) => {
    const { jsonl, seed } = Input.parse(req.body);
    res.json(prepareDataset(jsonl, { seed }));
  });
  app.post('/api/fine-tuning/compare', async (req, res) => {
    const input = Comparison.parse(req.body);
    if (env.FINETUNE_COMPARE_ENABLED !== 'true')
      throw new AppError(
        422,
        'COMPARISON_NOT_CONFIGURED',
        'Start the base and adapter MLX servers, set FINETUNE_COMPARE_ENABLED=true, then restart the API.',
      );
    // URLs are server-owned. The browser cannot turn this endpoint into an arbitrary URL proxy.
    async function generate(url) {
      const response = await requestJson(`${url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'default_model',
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.question },
          ],
          temperature: 0,
          max_tokens: 200,
          stream: false,
        }),
      });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string')
        throw new AppError(502, 'INVALID_MODEL_OUTPUT', 'Local model server returned no answer.');
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* Preserve raw output so format failures are visible. */
      }
      const schemaValid = z
        .object({
          category: z.enum(['chunking', 'retrieval', 'generation', 'operations']),
          next_step: z.string().min(1),
        })
        .strict()
        .safeParse(parsed).success;
      return { text, schemaValid, usage: response.usage || null };
    }
    // Sequential requests reduce peak unified-memory pressure on a small Mac.
    const base = await generate(env.FINETUNE_BASE_URL || 'http://127.0.0.1:8081/v1');
    const tuned = await generate(env.FINETUNE_TUNED_URL || 'http://127.0.0.1:8082/v1');
    res.json({
      question: input.question,
      base,
      tuned,
      note: 'Actual server responses. Schema validity is not category accuracy or evidence of improvement.',
    });
  });
}
