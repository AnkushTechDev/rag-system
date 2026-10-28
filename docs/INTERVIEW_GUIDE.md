# RAG interview guide

Use these as prompts for your own explanations. An interview answer is strongest when you explain the mechanism, a tradeoff, and an experiment from this app.

## Foundations

**1. What is RAG?** Retrieve relevant external information at inference time and provide it as context to a generator. Explain the offline ingestion pipeline separately from the online query pipeline. Retrieval errors, context errors, and generation errors are different failure classes.

**2. Why not just put every document in the prompt?** Context windows and latency/cost are finite, irrelevant content can distract the model, and documents may have different permissions. Retrieval selects a small, relevant and authorized subset. Long-context models may change the tradeoff; benchmark rather than assume retrieval is always necessary.

**3. RAG versus fine-tuning?** RAG supplies changing or private evidence without changing weights. Fine-tuning adapts model behavior or patterns through weight updates. They can be combined. Neither makes unknown facts automatically reliable.

**4. Do you need LangChain or agents?** No. A simple RAG system can call a retriever and generator directly. Frameworks can help with integrations and orchestration, but they do not replace knowledge of retrieval, source lifecycle, and evaluation. This app deliberately keeps the algorithms visible.

**5. What makes a strong ingestion pipeline?** Parsing, normalization, document identity, deduplication, chunking, metadata, batching, embedding model versioning, transactional publication, idempotency, lifecycle/deletion, and error recovery. Do not silently skip failed files.

## Retrieval mechanics

**6. How do you pick chunk size?** Tune with real answer spans and retrieval evaluation. Small chunks can omit context; big chunks can dilute relevance. Overlap increases continuity and duplication. Consider document structure, token budget, tables, and parent/child retrieval. This app uses character units for transparency.

**7. Explain BM25.** For each query term, multiply IDF by a saturating TF factor with document-length normalization, then sum. A common formulation is:

```text
IDF(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
BM25(q,d) = Σ IDF(t) × [tf(t,d) × (k1+1)] /
             [tf(t,d) + k1 × (1-b + b × |d|/avgdl)]
```

Here N counts chunks, df counts chunks containing the term, and length counts tokens from this implementation’s tokenizer. k1 controls frequency saturation; b controls length normalization. This app’s transparent implementation is not a production inverted index.

**8. Explain embeddings and cosine.** Embeddings place text in a learned vector space. Cosine compares directions: `dot(q,d) / (norm(q) × norm(d))`. It is not factual confidence. Same dimensions are necessary but not sufficient: model/provider spaces must match too.

**9. Why hybrid search?** Lexical search helps exact identifiers and rare words. Dense search can help semantic paraphrases. Either can fail; hybrid combines complementary signals. Measure the lift rather than assuming it always improves results.

**10. Explain RRF.** For each candidate, sum `1/(c + rank)` over rankings in which it appears. The common constant c=60 dampens rank differences. Ranks avoid mixing incompatible BM25 and cosine scales. A candidate found by both methods receives two contributions.

**11. What is reranking?** Usually a second-stage scorer compares query and candidate passages more carefully. A cross-encoder jointly encodes each query/passage pair and may improve ordering at extra latency. This app does not implement one; its MMR-style context selection reduces redundancy instead.

**12. Explain MMR.** Greedily choose a candidate by balancing query relevance and similarity to selected chunks. The app normalizes the retriever’s relevance score and penalizes maximum redundancy with cosine or Jaccard. Discuss lambda and why too much diversity can exclude the most relevant passages.

**13. Exact vector search versus ANN?** Exact search compares every vector. Approximate methods such as HNSW use an index to lower query work, with memory and recall/latency tradeoffs. Index construction parameters, search effort, quantization, filtering, and workload distribution matter.

**14. How would you filter by access?** Authenticate the user and apply document/tenant permission filters in the retrieval path before returning evidence. Prompting a model to ignore forbidden documents is not authorization. This local app has no tenant model and should not be exposed publicly.

## Generation and reliability

**15. How do you budget context?** Reserve tokens for system instructions, the question, history if present, evidence, and output. Rank/select chunks before packing. Character estimates are model-dependent approximations. This app only bounds evidence characters; it is not a universal token-limit proof.

**16. Does a real citation prove correctness?** No. Existence of a source label proves reference integrity, not that the source entails the claim. Evaluate claim-source support and whether the source itself is trustworthy/current. Contradictions should be surfaced rather than silently merged.

**17. How do you prevent hallucinations?** Improve retrieval, supply relevant evidence, request grounded answers, abstain when evidence is insufficient, validate output, and evaluate with human review. These reduce failure risk; none guarantees factual correctness. Retrieval thresholds need tuning on answerability-labelled data.

**18. What is prompt injection in RAG?** Retrieved text can contain instructions that compete with the intended task. Treat sources as untrusted data, separate them from instructions, restrict tools, enforce authorization outside the model, avoid secrets in context, and test adversarial examples. A stronger system needs defense in depth.

**19. How should a system handle no-answer questions?** Detect absent or insufficient evidence, avoid generation when no usable context exists, and let the generator explicitly abstain when retrieved context does not answer the question. Evaluate false refusals and false answers separately. Lexical overlap alone is not proof of answerability.

## Evaluation and debugging

**20. Explain recall@k, MRR and nDCG.** Recall@k is retrieved relevant items divided by all labelled relevant items. Reciprocal rank is 1 divided by the position of the first relevant result; MRR averages it over questions. nDCG discounts relevance by rank and normalizes against ideal ordering. Specify document/chunk units, label quality, and graded versus binary relevance.

**21. What should a test dataset contain?** Real user questions, paraphrases, exact identifiers, typos, ambiguity, multi-hop questions, contradictions, no-answer examples, permission-sensitive questions, and malicious source text. Split development and held-out test sets. The app’s 12 synthetic vocabulary-aligned questions are only a smoke set.

**22. The answer is wrong: where do you look first?** Verify source ingestion and permissions; inspect whether the answer-bearing chunk was retrieved; inspect candidate ranking and context packing; inspect prompt and generation; verify citations and contradictory information. Do not try to fix missing evidence only by editing the generation prompt.

**23. How do you monitor cost and latency?** Separate embedding/indexing cost from query embedding, retrieval, reranking, and generation. Track stage latency, model/index versions, actual tokens, error rates, refusal rates, and quality regressions. Do not estimate dollars without verified provider prices and usage.

## System design

**24. Design for ten million documents.** Begin with workload and service-level targets. Use durable object storage for source files, metadata/authorization storage, an ingestion queue, extraction workers, idempotent chunk/embedding jobs, an ANN-capable vector index, retrieval service, model gateway, and an evaluation/observability pipeline. Distinguish eventual ingestion consistency from authorization correctness.

**25. How do updates and deletions work?** Version documents and chunks, invalidate affected cache entries, publish consistent index revisions, remove old vectors after the required retention window, and honor hard-deletion obligations in backups/logs where required. This demo versions snapshots but does not implement physical Qdrant cleanup.

**26. What should be cached?** Embeddings for unchanged text within the same embedding space; possibly retrieval results or answers. Cache keys need tenant/access context, corpus revision, model/prompt version and relevant settings. A stale cached answer can leak deleted or newly unauthorized information.

**27. Why a modular monolith here?** It makes data flow and invariants inspectable with fewer operational failure modes. Pure core algorithms, use cases, adapters, and HTTP boundaries can be tested independently. Split services only when scaling, isolation, ownership, or reliability needs justify the complexity.

## Explain this project in two minutes

“I built a JavaScript RAG workshop with a Next.js UI and an Express modular monolith. Documents are normalized, chunked with offsets, optionally embedded, and published as immutable snapshots. Questions use BM25, cosine search, or hybrid RRF; context is diversified and budgeted before grounded generation. I inspect candidates, citations, timings, and retrieval metrics. Tests cover ranking, persistence, provider contracts and HTTP. The no-key mode is honestly extractive. Its limits include single-process JSON storage, no authentication, no physical vector cleanup, and no factual-entailment validator. My next steps would be a real held-out dataset, durable metadata/permission storage, ANN load testing, and generation-quality evaluation.”

Only claim experiments you actually ran. Do not claim the optional providers or production controls are deployed just because adapters exist.
