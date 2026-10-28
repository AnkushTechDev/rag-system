# Verification record

Validated on 28 October 2026 with Node.js 22.23.2 in the actual `rag-system` folder.

- `npm test`: 25 passing tests, including an actual loopback HTTP integration test.
- `npm run eval`: 12 synthetic document-level BM25 fixtures; recall@3, MRR@3 and nDCG@3 each 1.000. The fixtures share vocabulary with the starter corpus and are not a held-out benchmark.
- `npm run build`: production Next.js build passed.
- `npm run format:check`: passed.
- Running frontend: HTTP 200, expected page heading present.
- Same-origin Next.js proxy: health, query, evaluation and learning endpoints passed.
- Starter corpus: six documents, 15 chunks; sample RRF query returned cited sources and six measured pipeline stages.

Ollama, OpenAI and Qdrant adapters were tested with mocked transport contracts and a fake-model orchestration test. They were **not tested against live services** in this run. Actual semantic retrieval and generation require your configured provider.

Browser automation could not start in this session, so screenshot-based visual verification and browser interaction testing remain unverified. The production build and HTTP checks do not substitute for visual QA.
