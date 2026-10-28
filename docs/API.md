# HTTP API

Default backend: `http://127.0.0.1:4100`. Browser requests use the same paths through Next.js at port 3100. All bodies are JSON; errors use `{ "error": { "code", "message", "requestId" } }`.

| Method | Path                 | Purpose                                                                              |
| ------ | -------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/health`        | Provider capability, corpus stats, active index revision; never returns API keys     |
| GET    | `/api/documents`     | Document metadata and chunk counts                                                   |
| GET    | `/api/documents/:id` | Full text and offset-labelled chunks without vectors                                 |
| POST   | `/api/documents`     | Validate, deduplicate, chunk, embed if live, and atomically publish                  |
| POST   | `/api/index/rebuild` | Re-chunk all documents with explicit settings                                        |
| POST   | `/api/queries`       | Return an answer, sources, candidates, reference check, settings and measured stages |
| GET    | `/api/learn`         | Eight interview-practice topics                                                      |
| GET    | `/api/evaluations`   | BM25-only document-level regression metrics on current corpus; no generation calls   |

## Add a document

```sh
curl http://127.0.0.1:4100/api/documents   -H 'Content-Type: application/json'   -d '{"title":"My notes","content":"A long enough note about vector search and retrieval for this example.","chunkSize":700,"overlap":120}'
```

Title: 1–120 trimmed characters. Content: 30–30,000 trimmed characters. Chunk size: 100–2000 characters. Overlap: at least 0 and strictly less than half chunk size. Defaults: 700/120. Duplicate normalized content returns 409 regardless of title. Corpus limits are described in the README.

## Query

```sh
curl http://127.0.0.1:4100/api/queries   -H 'Content-Type: application/json'   -d '{"question":"What is reciprocal rank fusion?","mode":"lexical","topK":4,"contextBudget":6000,"diversify":true}'
```

Question: 3–2000 characters. Modes: lexical, dense, hybrid. Demo only supports lexical. Top k: 1–8 chunks before budget packing. Context budget: 500–12,000 character units. Queries are independent; no prior conversation is included. Candidate lists contain up to 20 results. Scores are retriever/rank-fusion signals, not probabilities.

A result includes `answer: {answer, supported, citations}`, `sources`, `candidates`, `trace`, `stats`, `usage`, `indexId`, and `settings`. Source labels are per-response S1/S2/etc.; chunk IDs are UUIDs per index revision. Store the index ID if recording experiments.

## Reindex

```sh
curl http://127.0.0.1:4100/api/index/rebuild   -H 'Content-Type: application/json'   -d '{"chunkSize":400,"overlap":60}'
```

This changes the current index, not just the next query. New chunk boundaries may require paid embedding calls in hosted mode. Previously returned experiments still refer to their original snapshot.

## Status codes

- 200 success; 201 document created.
- 400 invalid fields or malformed JSON.
- 404 unknown route/document.
- 409 duplicate content.
- 413 body too large (256kb).
- 422 unsupported mode or workspace limit.
- 429 three active queries are already running.
- 502 upstream service/model failure or invalid provider output.
- 500 unexpected internal failure; use the request ID to inspect server logs.

This API has no login or authorization and is bound to loopback for local learning. It is not a public multi-tenant API.

## Fine-tuning learning endpoints

- `GET /api/fine-tuning`: sample JSONL, comparison configuration, and an explicit external-training-not-tracked status.
- `POST /api/fine-tuning/prepare`: `{jsonl, seed?}` validates and returns train/valid/test JSONL strings, counts, warnings and fingerprint. Preparation does not write weights, launch jobs or call a model. Validation issues are returned in a `valid:false` report; malformed request fields return 400.
- `POST /api/fine-tuning/compare`: `{question, system?}` calls the two configured local servers, returning actual base/tuned responses and support-triage schema validity. Requires `FINETUNE_COMPARE_ENABLED=true`; otherwise 422. Model server URLs are server-owned environment configuration, never user-provided URLs.

See FINE_TUNING.md for the optional CLI/Python workflow and comparison limitations.
