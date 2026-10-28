import { z } from 'zod';
// Validate at network boundaries. Plain JavaScript + JSDoc does not replace runtime validation.
export const ChunkSettings = z
  .object({
    chunkSize: z.number().int().min(100).max(2000).default(700),
    overlap: z.number().int().min(0).max(900).default(120),
  })
  .refine((value) => value.overlap < value.chunkSize / 2, {
    message: 'Overlap must be smaller than half the chunk size.',
  });
export const DocumentInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(30).max(30000),
    chunkSize: z.number().int().min(100).max(2000).default(700),
    overlap: z.number().int().min(0).max(900).default(120),
  })
  .refine((value) => value.overlap < value.chunkSize / 2, {
    message: 'Overlap must be smaller than half the chunk size.',
  });
export const QueryInput = z.object({
  question: z.string().trim().min(3).max(2000),
  mode: z.enum(['lexical', 'dense', 'hybrid']).default('lexical'),
  topK: z.number().int().min(1).max(8).default(4),
  contextBudget: z.number().int().min(500).max(12000).default(6000),
  diversify: z.boolean().default(true),
});
