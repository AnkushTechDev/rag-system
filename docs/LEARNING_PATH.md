# Seven sessions to understand RAG

There is no guarantee of passing an interview. The goal is to explain mechanisms, reason about failures, and demonstrate experiments in your own words. Each session has a reading, a concrete task, and a question you should be able to answer without looking at the code.

## Session 1 — Run the entire pipeline

Read README.md and the `query()` method in `apps/api/src/rag-service.js`. Run the app, ask what RAG is, and open a source passage. Match each pipeline stage to a function. Explain ingestion versus inference, RAG versus fine-tuning, and why this app does not need an agent.

Task: draw the architecture on paper. Explain the exact path from pressing Enter to seeing source citations.

## Session 2 — Own the data preparation

Read `chunking.js` and the chunking tests. Add a note using your own words. Inspect its offsets. Rebuild at 400/60 and 1000/150 size/overlap. Observe chunk count and repeated context. All offsets are into normalized text, not the original file bytes.

Task: explain why a boundary-aware splitter is useful, why overlap is not free, and why character count is not token count. Extend a test with mixed emoji and paragraph boundaries.

## Session 3 — Derive lexical search

Read `bm25()` in `retrieval.js` and the interview equations. Work through a tiny corpus by hand. Query an exact acronym, then a synonym that does not appear in the sources. Observe what BM25 cannot do.

Task: explain inverse document frequency, term-frequency saturation, and length normalization. Add a hard lexical retrieval fixture rather than just another easy exact match.

## Session 4 — Run real semantic RAG

Configure Ollama or OpenAI using the README. Understand what leaves your machine with a hosted provider. Inspect the embedding fingerprint and stored dimensions. Compare lexical, dense, and hybrid results on a paraphrase. Do not compare the raw BM25 score to cosine.

Task: implement cosine on paper. Explain why mixing embedding spaces is invalid even if dimensions match. Describe exact search versus HNSW and the tradeoff between latency and recall.

## Session 5 — Select evidence and ground the answer

Read RRF, diversification, `buildContext()`, `generate()`, and `validateCitations()`. Toggle diversification. Lower the context budget. Compare selected sources with candidates. Try a no-answer query, then a malicious instruction inside a synthetic document.

Task: distinguish RRF, MMR, and cross-encoder reranking. Explain why a real citation and a valid JSON schema still do not prove factual support.

## Session 6 — Measure and debug

Run `npm test` and `npm run eval`. Read the labelled fixtures and explain why they are easy. Add at least five difficult questions and two no-answer examples. Keep a separate held-out set. Record whether each failure happened in retrieval, context construction, or generation.

Task: derive recall@k, reciprocal rank, and nDCG. Explain why you must define document-level versus chunk-level relevance. Add a generation-evaluation rubric that a human can consistently apply.

## Session 7 — Defend a production design

Read ARCHITECTURE.md and the system-design section of INTERVIEW_GUIDE.md. Sketch a ten-million-document, multi-tenant deployment. Include authorization before retrieval, asynchronous ingestion, retries, vector indexes, deletion, caching, backups, evaluation, and observability.

Task: give a five-minute explanation of this app: problem, pipeline, implementation choices, validation, limitations, and next steps. Explain which complexities you deliberately did not implement and when you would add them.

## A useful portfolio demonstration

Show one successful question, one lexical failure fixed by semantic retrieval, one refusal, and one measured improvement after changing a setting. Explain the evidence for improvement rather than merely showing a polished interface. Be honest about what you implemented and what remains a prototype.
