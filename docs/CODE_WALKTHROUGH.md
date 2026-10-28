# Follow the code without guessing

All application code is JavaScript. ESM imports use `import`/`export`; backend local imports include `.js` extensions because Node resolves them directly. npm workspaces link `@rag/core` into the API without publishing a package.

Comments explain intent and tradeoffs. This document explains every source module. Standard UI markup and styling are not individually narrated line by line: use the module purpose and request flow to understand how those lines fit together.

## Start at the composition root

`apps/api/src/server.js` reads validated configuration, awaits indexing, creates Express, and binds to loopback. Startup fails explicitly if a configured provider or index cannot be initialized. Shutdown stops new traffic and gives requests a short grace period.

`config.js` validates provider names, ports, and similarity thresholds with Zod. `RAG_PROVIDER=demo` is an explicit capability boundary. It rejects `demo + qdrant` because that combination has no real vectors. Server-owned URLs are configuration, not user-submitted URLs.

`bootstrap.js` creates dependencies in one place: repository, model provider, vector adapter, and application service. This is dependency injection without a framework. Tests can inject a fake provider while exercising the real query logic.

## HTTP and validation

`app.js` defines the HTTP boundary. Middleware attaches a request ID and bounds JSON body size. Routes parse bodies before calling use cases. Express 5 forwards rejected async route promises to the error handler. Query concurrency is limited to three active requests in one process. A disconnected response aborts pending provider fetches; a total query signal limits remote work.

`validation.js` declares document, chunk-setting, and query schemas. Defaults are applied on the server. The overlap refinement prevents non-progressing splitters. Browser form restrictions improve usability; server validation establishes the actual boundary.

`errors.js` defines `AppError`: a controlled status/code/message that can be returned to callers. Unknown exceptions are logged with a request ID and returned as a generic error; prompts, keys, and entire bodies are not logged. This does not replace production log review or error monitoring.

## Ingestion and immutable snapshots

`rag-service.js` is the application layer. `initialize()` loads a snapshot and reindexes if the embedding signature changes. `ingest()` normalizes content, rejects duplicate content hashes, checks limits, and serializes a publication through the repository. `reindex()` changes all document chunk settings. `document()` returns source text and offsets without embedding arrays.

`buildIndex()` prepares a new snapshot containing documents, chunks, provider/model signature, and a revision ID. It reuses vectors for identical chunk text only when the embedding signature matches. New chunks receive new UUIDs per snapshot. Changed models or chunk boundaries require new vectors. Vector-store synchronization happens before the local snapshot is published; failed remote publication cannot expose an incomplete local index.

`repository.js` serializes writes through a promise queue and writes to a temporary file before rename. Only after a successful rename does it replace the in-memory snapshot. A rejected operation is caught on the queue chain so later writes can still proceed. This is a **single-process** repository; two API processes must not share the same JSON file.

`seeds.js` contains six synthetic documents for reproducible learning. These are educational examples, not imported enterprise knowledge. The generated `data/index.json` is ignored by Git.

## Pure retrieval algorithms

`chunking.js`: `normalizeText()` standardizes newlines and removes null characters. `chunkText()` chooses boundaries near the target size, overlaps adjacent chunks, records start/end offsets, protects surrogate pairs, and guarantees forward progress. It uses characters, not model tokens; semantic chunking is not implemented.

`retrieval.js`: `tokenize()` lowercases Unicode words and removes a small English stopword list. `bm25()` computes a transparent lexical score per chunk. It scans small arrays for readability rather than maintaining a production inverted index. `cosine()` rejects incompatible dimensions instead of silently masking an indexing error. `reciprocalRankFusion()` sums reciprocal rank contributions for matching chunk IDs. `diversify()` selects relevant candidates while penalizing redundancy, using vector cosine when available and token-set Jaccard overlap in demo mode.

`context.js`: `buildContext()` includes complete chunks within a character budget, gives them stable per-response labels S1/S2/etc., and omits embedding vectors. `validateCitations()` checks that citation labels exist, inline markers match the citation list, and a claimed supported answer includes references. This is reference integrity, not entailment verification.

`evaluation.js`: `retrievalMetrics()` deduplicates document titles, then computes recall, reciprocal rank, and nDCG within k unique documents. The fixtures therefore define **document-level** relevance; these are not chunk-level metrics. Distinct documents with identical titles are conflated by this teaching metric; production datasets should label stable document IDs.

## Models and vector stores

`providers.js`: `requestJson()` combines deadlines and cancellation, checks HTTP status, and returns controlled upstream errors. `ModelProvider.embed()` batches inputs, restores OpenAI result ordering, validates dimensions, and returns null vectors in demo mode. `generate()` sends a system instruction and evidence in a separate user payload. Ollama gets a JSON schema via `format`; OpenAI gets strict JSON schema via `response_format`. Model output is parsed with Zod before it can enter the result.

Demo generation returns extracts with source labels. Live generation can synthesize explanations. Neither mode should be mistaken for a guarantee of factual support. Prompt-injection instructions in source text remain a risk; separation and prompting are not a complete defense.

`vector-store.js`: `DiskVectorStore` runs exact cosine against the persisted snapshot vectors. `QdrantVectorStore` checks collection existence, creates the dimensioned collection if needed, uploads UUID points, and queries with a snapshot filter. It joins returned IDs to authoritative local metadata. Old version points are retained for concurrent readers; physical retention cleanup is outside this prototype.

## Trace a query

1. `QueryInput.parse()` applies bounds and defaults.
2. `query()` captures one index snapshot, avoiding mixed revisions during ingestion.
3. It runs BM25, dense search, or both depending on retrieval mode. Demo rejects dense/hybrid instead of faking semantics.
4. Hybrid mode fuses ranks. Optional diversification chooses the final k candidates.
5. Context packing fits complete source chunks in a bounded budget.
6. Empty context leads to an abstention with no generation call.
7. Otherwise the provider returns structured output; the reference guard checks it.
8. The response contains sources, candidates, settings, index ID, timings, and actual provider usage when available. Raw vectors are removed.

Each `stage()` measures elapsed time around actual execution. The UI displays completed-stage timings after the request; it does not simulate token streaming or expose private chain-of-thought.

## Frontend modules

`app/layout.js` is a Server Component with page metadata and global styles. `app/page.js` is the Client Component entry point, because it composes interactive tabs and React state.

`hooks/use-workshop.js` holds presentation state, fetches independent bootstrap data concurrently, invokes queries, stores at most eight browser-session results, and aborts a query when unmounted. Experiment history is not persisted and does not act as conversational memory.

`lib/api.js` is the shared fetch boundary. It serializes JSON bodies and surfaces server messages. The Next.js rewrite keeps requests same-origin. Provider keys stay in the API process; they are not returned by the health endpoint.

`components/sidebar.js` supplies navigation and session experiment history. `components/playground.js` contains query controls, source/candidate inspection, and the measured pipeline view. Settings map to backend schemas; the UI cannot enable fake dense mode in the demo.

`components/knowledge.js` contains document inspection, reindex controls, and an ingestion dialog. It validates file length before upload, constrains focus inside the modal, and restores focus on close. Server validation is still authoritative.

`components/learning.js` contains expandable interview cards and the evaluation dashboard. The dashboard runs a BM25-only baseline without generation calls. `learning.js` on the backend supplies the card content.

`next.config.mjs` reads the root environment and rewrites `/api/*` to Express. `globals.css` contains tokens, component styles, responsive breakpoints, focus styles, and reduced-motion support. It contains no retrieval logic.

## Tests and scripts

`packages/rag-core/test/algorithms.test.js` tests mathematical behavior, Unicode boundaries, context budget and citation failures. `apps/api/test/service.test.js` exercises real composition with temporary snapshots and fake model adapters. `providers.test.js` mocks transport responses to test request contracts; it is not a live provider integration test. `http.test.js` exercises Express with an actual ephemeral loopback listener.

`fixtures/evaluation.json` contains question/relevant-document pairs. `scripts/evaluate.js` builds an isolated corpus, runs lexical retrieval, and reports document-level metrics. Its threshold detects regressions, not enterprise readiness. The UI evaluation uses the current corpus; the CLI uses isolated starter data.
