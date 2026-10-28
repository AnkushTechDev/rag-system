// Small synthetic knowledge base: not scraped company documents or an external authority.
export const seedDocuments = [
  {
    title: 'RAG fundamentals',
    slug: 'fundamentals',
    content: `Retrieval-augmented generation (RAG) combines a retriever with a language model. At ingestion time documents are cleaned, split into chunks, embedded, and indexed. At query time the application retrieves relevant chunks, assembles a bounded context, and asks the model to answer from that evidence. RAG supplies external information at inference time; it does not modify model weights.

RAG is useful for private or frequently changing knowledge. Fine-tuning adjusts model behavior by changing weights and is often useful for style or specialized patterns. RAG and fine-tuning can be combined. Neither guarantees factual correctness. A language model can hallucinate even when a correct passage appears in the context. Verify citations and evaluate whether each claim is supported.

A basic RAG pipeline does not need an autonomous agent. Agents choose actions or tools dynamically; a retrieval workflow follows explicit stages. Start with a simple pipeline and add complexity only when measured failures justify it.`,
  },
  {
    title: 'Chunking and context windows',
    slug: 'chunking',
    content: `Chunking divides documents into smaller units that fit retrieval and model context constraints. Fixed-size splitting is simple but can cut across topics. Recursive splitting prefers paragraph and sentence boundaries. Semantic splitting groups related ideas but adds cost and model dependencies.

Chunk overlap repeats part of the previous chunk to preserve continuity near boundaries. More overlap increases storage and embedding cost and can retrieve redundant passages. Very small chunks may lose context; very large chunks may include distracting text and dilute retrieval relevance. Chunk size and overlap should be tuned on representative questions rather than treated as universal constants.

Tokens are model-specific text units; characters are not tokens. The context window contains system instructions, question, retrieved evidence, history if any, and generated output. Reserve room for all of them. A character budget is only an approximation. Store chunk offsets and source metadata so a user can trace an answer back to its document.`,
  },
  {
    title: 'Embeddings and vector databases',
    slug: 'vectors',
    content: `An embedding maps text into a numeric vector. Related meanings tend to have similar directions in embedding space. Cosine similarity is the dot product divided by the product of vector lengths. A similarity score is not a calibrated probability that a source answers the question. Query and document vectors must use the same embedding model and dimensions. Model changes require re-embedding or a separate index.

Exact vector search compares a query with every indexed vector and has linear cost in the number of vectors. Approximate nearest-neighbor search trades some recall for lower latency at scale. HNSW is a graph-based approximate index; its construction and search parameters trade memory, latency, and recall. Qdrant and PostgreSQL with pgvector are examples of vector storage approaches.

A vector database stores vectors and metadata and supports similarity queries. Apply tenant authorization and metadata filters before returning evidence. Keep document lifecycle and vector lifecycle synchronized: deleted documents must not remain retrievable. In this learning app immutable snapshot IDs filter searches to the active index.`,
  },
  {
    title: 'BM25, hybrid search and reranking',
    slug: 'retrieval',
    content: `BM25 is a lexical ranking function that uses term frequency saturation, inverse document frequency, and document length normalization. Rare terms are more informative than terms found everywhere. BM25 works well for exact identifiers, product names, and acronyms but usually misses synonyms with no shared tokens.

Dense retrieval searches embedding vectors to match semantic meaning. Hybrid retrieval combines sparse or lexical retrieval with dense retrieval. Reciprocal rank fusion sums 1 divided by a constant plus the rank for each list. RRF combines ranks rather than assuming BM25 and cosine scores have the same scale.

Maximal marginal relevance (MMR) balances query relevance with diversity, penalizing chunks too similar to already selected context. A cross-encoder reranker jointly scores the query and each candidate passage; this can improve relevance but adds latency and compute. MMR is a diversification method and is not the same thing as a cross-encoder reranker. Retrieve a larger candidate set before selecting the final context.`,
  },
  {
    title: 'Evaluation and failure analysis',
    slug: 'evaluation',
    content: `Evaluate retrieval separately from generation. Recall at k measures the fraction of relevant items present among the first k results. Mean reciprocal rank averages the inverse rank of the first relevant result. nDCG rewards placing relevant results near the top; graded relevance labels allow richer evaluation. Define whether an item means a document or a chunk before computing metrics.

Generation evaluation includes groundedness, citation accuracy, completeness, usefulness, and correct abstention when evidence is missing. Validating that a citation ID exists does not prove entailment. LLM judges can help but require calibration against human judgments. Keep held-out test questions separate from examples used to tune prompts and retrieval.

Record retrieval and generation latency separately, model versions, index versions, and token usage when available. Include questions with typos, synonyms, ambiguous wording, contradictory documents, no answers, and malicious text in documents. Debug missing retrieval before changing the generation prompt. A tiny hand-written test dataset is a smoke check, not evidence of production quality.`,
  },
  {
    title: 'Production, security and prompt injection',
    slug: 'production',
    content: `Retrieved documents are untrusted input. A document may contain prompt injection instructions that try to override system behavior or request secret data. Separate instructions from evidence, restrict tool permissions, and do not treat prompt wording as a complete security boundary. Render generated text as text rather than unsafe HTML.

Production RAG requires authentication, tenant authorization, document access filters, rate limits, bounded request sizes, secrets management, backups, observability, and deletion workflows. Keep provider keys on the backend. Never expose a local prototype publicly without adding these controls. Version the embedding model, chunking settings, corpus, and prompt so failures can be reproduced.

Cache keys must include the tenant, corpus or index version, retrieval settings, question, and model or prompt version as appropriate. Invalidate cached answers after document changes. Use queues and idempotency for large ingestion jobs. Retry only safe operations with backoff, and avoid silently substituting demonstration output when a real model fails.`,
  },
];
