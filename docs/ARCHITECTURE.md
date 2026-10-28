# Architecture decisions

## JavaScript and a modular monolith

The requested goal is RAG understanding, not decorator-based framework infrastructure. Express keeps HTTP routing thin and application logic testable in ordinary JavaScript. Next.js provides the interface. npm workspaces manage both applications and the pure algorithm package in one repository. This is a monorepo; the backend is a modular monolith. They describe different things.

## Dependency direction

The core package knows nothing about HTTP, storage or providers. The application service composes core functions with injected ports. Adapters implement models, vector search and persistence. The HTTP layer validates requests and calls use cases. React only presents inputs and outputs. This avoids coupling the retrieval algorithms to an API framework or browser.

## Exact search first, optional Qdrant

Small exact search is useful for learning cosine and assessing ANN tradeoffs. Persisting vectors avoids repeated embedding calls on restart. A Qdrant adapter demonstrates real collection creation, upsert, filtering and queries, but does not automatically make the app production-ready. Model and dimension fingerprints separate vector spaces. Model weight replacement under the same identifier requires explicit clean reindexing.

## Atomic publication and snapshot consistency

Build all chunks/vectors for a new snapshot, sync remote points, atomically rename the local JSON, then publish the in-memory pointer. Queries capture one snapshot and continue using it even during ingestion. UUID points per revision let Qdrant filter old and new snapshots independently. A remote write followed by a failed local write can leave orphan points, so garbage collection is a necessary production upgrade.

The queue serializes writes in one process. It is not a distributed transaction, database isolation level, or multi-process lock. One API instance per data file is required.

## No hidden demonstrations

Demo mode uses real lexical search and extractive display. Semantic options are explicitly unavailable. Live adapters fail rather than substituting fake output. Traces are measured program stages. Estimated context tokens are labelled approximate. Citation validation checks identifiers, not truth. The UI baseline evaluates BM25 on the current corpus; the CLI uses isolated starter fixtures.

## What is deliberately missing

Authentication, tenant authorization, production rate limiting, uploaded binary parsing/OCR, background queues, streaming generation, a learned reranker, answer caching, durable conversations, multi-agent execution, and physical Qdrant retention cleanup. These should be added to solve measured requirements, not to fill a technology checklist.

## Practical production upgrade sequence

1. Define a representative evaluation dataset and operational requirements.
2. Add authenticated ownership and permission filtering to metadata and vector queries.
3. Move metadata/index state into a transactional store and source files into durable storage.
4. Add asynchronous, idempotent ingestion with job visibility, retries and deletion semantics.
5. Benchmark exact versus ANN retrieval, then tune index parameters and reranking.
6. Add token/cost budgets, monitoring, redaction, backups, retention, load tests and deployment automation.

The existing modules create places to implement those concerns without rewriting the core algorithms.
