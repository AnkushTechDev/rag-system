# RAG Workshop

A **plain JavaScript** RAG learning app designed to help you understand the implementation and explain the tradeoffs in interviews. It includes an Express backend, Next.js frontend, inspectable retrieval algorithms, persistent indexing, citations, and evaluation.

Architecture: **npm-workspaces monorepo + modular monolith**. The UI and API run as two local processes, but application logic is one backend with clear modules. Microservices and an agent framework would obscure the fundamentals here. NestJS is not needed for this JavaScript project.

## Run it

Requires Node.js **22.12+**; tested with 22.23.2. From this folder:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open [RAG Workshop](http://127.0.0.1:3100). The API is at [localhost:4100/api/health](http://127.0.0.1:4100/api/health).

No key is required. Six synthetic RAG guides are indexed automatically. Ask a question, inspect selected chunks and candidate rankings, then compare the measured pipeline stages. Add your own `.txt` / `.md` notes in the Knowledge base. The app does not parse PDF, DOCX, images, or web URLs.

**Demo mode is not real model inference:** it runs BM25, context selection, and reference validation, then displays source extracts. It does not create fake semantic embeddings or pretend an LLM answered. Dense/hybrid options are disabled until a real provider is configured.

## Enable real RAG locally with Ollama

Install Ollama separately, start it, and pull both models:

```sh
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

Set in root `.env`, then restart the app:

```dotenv
RAG_PROVIDER=ollama
OLLAMA_CHAT_MODEL=llama3.2:3b
OLLAMA_EMBED_MODEL=nomic-embed-text
VECTOR_STORE=disk
```

The first start embeds the starter corpus. Later starts reuse persisted vectors when the provider/model fingerprint matches. Choose dense or hybrid in **Retrieval settings**. Models require local RAM/disk and may be slow on some machines; the defaults are examples, not claims to be the newest or best models.

## Enable hosted OpenAI models

```dotenv
RAG_PROVIDER=openai
OPENAI_API_KEY=your-server-side-key
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBED_MODEL=text-embedding-3-small
VECTOR_STORE=disk
```

Restart the API. Provider calls incur usage charges. Use models your account can access; the chat model must support the implemented structured-output schema. API keys remain on the server. Never use `NEXT_PUBLIC_` for secrets. Provider failures return explicit errors rather than silently substituting demo output.

OpenAI uses the documented Chat Completions endpoint for a small, single-turn generation request. This is a deliberate compatibility choice, not a claim that it is the newest OpenAI API. Ollama uses `/api/embed` and `/api/chat`.

## Optional vector database: Qdrant

The default `disk` adapter stores vectors in the local snapshot and runs **exact cosine search**. That makes the algorithm readable; it does not scale like an ANN index.

With Docker installed:

```sh
docker compose up -d qdrant
```

Set a real provider and `VECTOR_STORE=qdrant` in `.env`, then restart. The adapter creates a collection using the embedding fingerprint and dimensions, upserts versioned points, and queries with an active snapshot filter. The local index remains the metadata source of truth.

The included Compose service exposes Qdrant only on loopback. It is optional; nothing starts Docker automatically. Contract tests exercise request construction. Running against actual Ollama, OpenAI, and Qdrant services requires those services/credentials and is a separate verification step.

## Fine-tuning lab

Open **Fine-tuning lab** to inspect 32 synthetic training demonstrations, validate/deduplicate them, prevent scenario leakage, and download deterministic training/validation/test files. A separate MLX LoRA launcher performs actual local training on Apple Silicon when explicitly executed. The optional comparison calls real base/adapter servers; it never fabricates tuned outputs. Preparing data does not train a model.

See [the complete fine-tuning workflow](docs/FINE_TUNING.md) for setup, training, held-out evaluation, serving, code explanations, and interview questions. The example teaches structured support-triage behavior separately from RAG evidence retrieval.

```sh
npm run finetune:prepare                 # offline files + versioned manifest
npm run finetune:train -- --run RUN      # plan only; no training or downloads
# After optional MLX installation, add --execute to launch real training.
```

## Commands

```sh
npm run dev           # API + Next.js frontend, with file watching
npm test              # algorithm, service, provider-contract and HTTP tests
npm run eval          # isolated 12-question BM25 retrieval evaluation; no model calls
npm run format        # readable, consistent source formatting
npm run format:check  # verify formatting
npm run build         # production frontend build
npm start             # production API + frontend, after build
```

Backend JavaScript runs directly on Node; there is no unnecessary transpilation step. Tests create temporary indexes and never modify your real knowledge base. The HTTP integration test opens an ephemeral loopback listener.

## How the system works

```text
INGESTION
text/Markdown → normalize → chunk + source offsets → embed (live only)
                    → build immutable snapshot → sync vector store → atomic publish

QUERY
question → runtime validation → BM25 and/or query embedding + vector search
         → optional reciprocal rank fusion → context diversification
         → bounded prompt context → generation / demo extracts
         → citation-reference validation → answer + evidence + trace

Next.js UI ── same-origin /api rewrite ── Express application
                                          │
                                  RagService (use cases)
                                   /       |        \
                         pure algorithms  models  index/vector adapters
```

| Location                       | Responsibility                                                                |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `apps/api/src/app.js`          | HTTP routes, request IDs, input validation, error boundary, query concurrency |
| `apps/api/src/rag-service.js`  | Ingestion, reindexing, query orchestration, snapshot consistency              |
| `apps/api/src/providers.js`    | Ollama/OpenAI embedding and generation adapters                               |
| `apps/api/src/repository.js`   | Serialized, atomic local index writes                                         |
| `apps/api/src/vector-store.js` | Exact disk search and optional Qdrant ANN adapter                             |
| `packages/rag-core/src/`       | Chunking, BM25, cosine, RRF, diversification, context, evaluation             |
| `apps/web/components/`         | Small UI modules for experimenting and learning                               |
| `fixtures/evaluation.json`     | Inspectable synthetic retrieval labels                                        |

## Learning material

1. [Seven-session learning path](docs/LEARNING_PATH.md): what to read and what to build each day.
2. [Code walkthrough](docs/CODE_WALKTHROUGH.md): every source module, important functions, and a request traced end to end.
3. [Interview guide](docs/INTERVIEW_GUIDE.md): explanations, equations, system design, and failure scenarios.
4. [Architecture decisions](docs/ARCHITECTURE.md): why these boundaries, storage choices, and limitations exist.
5. [API reference](docs/API.md): request/response examples and status codes.

## Limits you should understand

- Local learning workspace: one API process, no login or tenant isolation. Bindings use `127.0.0.1`. Do not expose the app publicly as-is.
- Index data and embeddings persist in ignored `data/index.json`. Browser experiment history resets on refresh. No answer cache or long-term conversational memory is implemented.
- 50 documents, 200,000 corpus characters, 30,000 characters/document, and 800 chunks. Query length is bounded; up to three queries execute concurrently.
- Chunk/context sizes use UTF-16 character units, not model tokens. Estimated tokens are labelled approximate. Actual generation token usage is shown when supplied by the provider.
- A cosine threshold depends on the model and corpus. BM25/RRF scores are not factual confidence. No learned cross-encoder is implemented; context diversification is not one.
- Citation validation checks reference integrity, not factual entailment. You still need groundedness evaluation and human inspection.
- Qdrant snapshots retain old points for consistent in-flight reads. Physical cleanup/retention is not implemented; this is not a production deletion/privacy workflow.
- Embedding fingerprints include provider/model, not upstream model weight digests. If a local model is replaced under the same name, rebuild with a clean separate index file or change the model identifier.
- Generation is single-turn and returned as JSON. Token streaming, agents, queues, OCR, authentication, and distributed locks are intentionally outside this version.
- The 12 synthetic, vocabulary-aligned queries are a smoke set. Perfect metrics here do not establish interview readiness or production quality.

## Official references

- [Next.js documentation](https://nextjs.org/docs)
- [Express error handling](https://expressjs.com/en/guide/error-handling.html)
- [Ollama embedding API](https://docs.ollama.com/api/embed), [chat API](https://docs.ollama.com/api/chat)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), [embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create)
- [Qdrant local quickstart](https://qdrant.tech/documentation/quickstart/), [query API](https://api.qdrant.tech/api-reference/search/query-points)
- [Original RAG paper](https://arxiv.org/abs/2005.11401)

Exact installed versions are recorded in `package-lock.json`. Use `npm ci` for reproducible installation.

A parent-repository CI workflow example is provided in `docs/ci.example.yml`. Copy it to the parent Git repository’s `.github/workflows/` to enable it; GitHub does not discover workflows nested inside this project folder. If this folder becomes its own Git repository, remove the `rag-system` working-directory/cache-path prefix.
