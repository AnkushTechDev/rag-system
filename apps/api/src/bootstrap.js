import { readConfig } from './config.js';
import { ModelProvider } from './providers.js';
import { IndexRepository } from './repository.js';
import { DiskVectorStore, QdrantVectorStore } from './vector-store.js';
import { RagService } from './rag-service.js';

/** Dependency injection without a framework: adapters are selected in one composition root. */
export async function bootstrap(config = readConfig()) {
  const provider = new ModelProvider(config);
  const vectorStore =
    config.vectorStore === 'qdrant' ? new QdrantVectorStore(config) : new DiskVectorStore();
  const service = new RagService({
    repository: new IndexRepository(config.dataFile),
    provider,
    vectorStore,
    config,
  });
  await service.initialize();
  return service;
}
