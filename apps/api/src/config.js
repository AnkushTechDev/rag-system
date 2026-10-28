import { resolve } from 'node:path';
import { z } from 'zod';

/** Read configuration once at the boundary; fail early rather than run with invalid settings. */
export function readConfig(env = process.env) {
  const schema = z.object({
    RAG_PROVIDER: z.enum(['demo', 'ollama', 'openai']).default('demo'),
    VECTOR_STORE: z.enum(['disk', 'qdrant']).default('disk'),
    API_PORT: z.coerce.number().int().min(1024).max(65535).default(4100),
    MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.3),
  });
  const parsed = schema.parse(env);
  if (parsed.RAG_PROVIDER === 'openai' && !env.OPENAI_API_KEY)
    throw new Error('OPENAI_API_KEY is required for RAG_PROVIDER=openai.');
  if (parsed.RAG_PROVIDER === 'demo' && parsed.VECTOR_STORE === 'qdrant')
    throw new Error('Qdrant needs real embeddings: choose ollama or openai.');
  return {
    provider: parsed.RAG_PROVIDER,
    vectorStore: parsed.VECTOR_STORE,
    port: parsed.API_PORT,
    minSimilarity: parsed.MIN_SIMILARITY,
    dataFile: env.RAG_DATA_FILE || resolve(import.meta.dirname, '../../../data/index.json'),
    ollamaUrl: env.OLLAMA_URL || 'http://127.0.0.1:11434',
    chatModel:
      parsed.RAG_PROVIDER === 'ollama'
        ? env.OLLAMA_CHAT_MODEL || 'llama3.2:3b'
        : env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini',
    embeddingModel:
      parsed.RAG_PROVIDER === 'ollama'
        ? env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
        : env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    openaiKey: env.OPENAI_API_KEY,
    qdrantUrl: env.QDRANT_URL || 'http://127.0.0.1:6333',
    qdrantKey: env.QDRANT_API_KEY,
  };
}
