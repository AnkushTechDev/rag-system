import { useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  GitBranch,
  LoaderCircle,
  Plus,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
const prompts = [
  {
    icon: Database,
    title: 'Start with the basics',
    text: 'What is RAG, and how is it different from fine-tuning?',
  },
  {
    icon: ScanSearch,
    title: 'Compare retrieval methods',
    text: 'How do BM25, dense retrieval, and hybrid search differ?',
  },
  {
    icon: ShieldCheck,
    title: 'Think like an interviewer',
    text: 'Does RAG eliminate hallucinations? How do we evaluate it?',
  },
];

/** Query knobs map directly to backend validation and pure retrieval functions. */
export function Playground({ status, result, busy, ask, onAdd }) {
  const [question, setQuestion] = useState(''),
    [mode, setMode] = useState('lexical'),
    [topK, setTopK] = useState(4),
    [diversify, setDiversify] = useState(true),
    [showSettings, setShowSettings] = useState(false),
    [contextBudget, setContextBudget] = useState(6000),
    [view, setView] = useState('sources');
  function submit(text = question) {
    if (text.trim().length < 3 || busy) return;
    void ask({ question: text, mode, topK, diversify, contextBudget });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> LEARN BY EXPERIMENTING
          </div>
          <h1>
            Retrieval playground<span>.</span>
          </h1>
          <p>A question, your documents, and a pipeline you can actually understand.</p>
        </div>
        <span className={`mode-pill ${status?.live ? 'live' : ''}`}>
          <span />
          {status?.live ? `${status.provider} connected` : 'No-key demo'}
        </span>
      </div>
      <div className="pipeline-strip">
        <span>THE RAG PIPELINE</span>
        {['Retrieve', 'Rank', 'Build context', 'Generate', 'Validate'].map((name, i) => (
          <span className="pipeline-stop" key={name}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            {name}
            {i < 4 && <ArrowRight size={12} />}
          </span>
        ))}
      </div>
      {!result ? (
        <section className="welcome">
          <div className="welcome-symbol">
            <ScanSearch size={29} />
            <span />
          </div>
          <span className="eyebrow">MAKE THE BLACK BOX A LITTLE CLEARER</span>
          <h2>What would you like to understand?</h2>
          <p>
            Ask a question. Inspect the retrieved evidence.
            <br />
            See exactly how an answer comes together.
          </p>
          <div className="suggestions">
            {prompts.map((prompt) => (
              <button
                key={prompt.title}
                onClick={() => submit(prompt.text)}
                disabled={busy || !status}
              >
                <prompt.icon size={20} />
                <h3>
                  {prompt.title}
                  <ArrowUpRight size={15} />
                </h3>
                <p>{prompt.text}</p>
              </button>
            ))}
          </div>
          <div className="ready-note">
            <span className="status-dot" />
            {status?.documents || 0} documents · {status?.chunks || 0} indexed chunks{' '}
            <button onClick={onAdd}>
              Add your own <Plus size={12} />
            </button>
          </div>
        </section>
      ) : (
        <section className="results">
          <div className="question-display">
            <span className="question-icon">Q</span>
            <h2>{result.question}</h2>
          </div>
          <div className="answer-header">
            <span className="answer-symbol">
              <Sparkles size={17} />
            </span>
            <strong>{result.provider === 'demo' ? 'Retrieved evidence' : 'Grounded answer'}</strong>
            <span>
              {result.provider === 'demo' ? 'Extractive demo · no LLM' : 'Structured model output'}
            </span>
          </div>
          <div className="answer-text">{result.answer.answer}</div>
          <div className="answer-metadata">
            <span>
              <ShieldCheck size={13} />
              {result.citationCheck.count} references validated
            </span>
            <span>
              <Clock3 size={13} />
              {result.stats.durationMs} ms
            </span>
            <span>{result.stats.contextCharacters.toLocaleString()} context characters</span>
          </div>
          <p className="reference-note">
            Reference validation checks source labels, not factual accuracy. Read the passages
            below.
          </p>
          <div className="result-tabs">
            <button
              className={view === 'sources' ? 'active' : ''}
              onClick={() => setView('sources')}
            >
              <FileText size={14} /> Selected context <span>{result.sources.length}</span>
            </button>
            <button
              className={view === 'ranking' ? 'active' : ''}
              onClick={() => setView('ranking')}
            >
              <GitBranch size={14} /> Candidate ranking <span>{result.candidates.length}</span>
            </button>
          </div>
          {view === 'sources' ? (
            <div className="source-grid">
              {result.sources.length ? (
                result.sources.map((source) => (
                  <details className="source-card" key={source.id}>
                    <summary>
                      <span className="source-label">{source.label}</span>
                      <div>
                        <h3>{source.title}</h3>
                        <small>
                          Chunk {source.index + 1} · characters {source.start}–{source.end}
                        </small>
                      </div>
                      <ChevronDown size={14} />
                    </summary>
                    <p>{source.text}</p>
                    <code>
                      Retrieval score: {source.score.toFixed(4)} · {result.mode}
                    </code>
                  </details>
                ))
              ) : (
                <p className="empty-note">
                  No passages fit this query and context budget. The system abstained.
                </p>
              )}
            </div>
          ) : (
            <div className="ranking-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Candidate passage</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.candidates.map((candidate, i) => (
                    <tr key={candidate.id}>
                      <td>{String(i + 1).padStart(2, '0')}</td>
                      <td>
                        <strong>{candidate.title}</strong>
                        <span>{candidate.text.slice(0, 110)}…</span>
                      </td>
                      <td>{candidate.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Scores are ranking signals, not probabilities.{' '}
                {result.mode === 'hybrid'
                  ? 'Hybrid scores use RRF.'
                  : 'Raw retriever scores are shown.'}
              </p>
            </div>
          )}
        </section>
      )}
      <div className="composer-area">
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="question" className="sr-only">
            Research question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your knowledge base…"
            rows={2}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="composer-toolbar">
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() => setShowSettings(!showSettings)}
              >
                <SlidersHorizontal size={14} /> Retrieval settings
              </button>
              <span className="toolbar-divider" />
              <span className="retrieval-label">
                {mode === 'lexical' ? 'BM25' : mode === 'dense' ? 'Dense' : 'Hybrid'}{' '}
                <span>· top {topK}</span>
              </span>
            </div>
            <button
              type="submit"
              className="send-button"
              disabled={busy || !status || question.trim().length < 3}
              aria-label="Run question"
            >
              {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={19} />}
            </button>
          </div>
          {showSettings && (
            <div className="query-settings">
              <label>
                Retrieval mode
                <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={busy}>
                  <option value="lexical">Lexical · BM25</option>
                  <option value="dense" disabled={!status?.live}>
                    Dense · embeddings
                  </option>
                  <option value="hybrid" disabled={!status?.live}>
                    Hybrid · BM25 + dense
                  </option>
                </select>
              </label>
              <label>
                Top k
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  disabled={busy}
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Context budget
                <select
                  value={contextBudget}
                  onChange={(e) => setContextBudget(Number(e.target.value))}
                  disabled={busy}
                >
                  {[2000, 4000, 6000, 10000, 12000].map((k) => (
                    <option key={k} value={k}>
                      {k.toLocaleString()} chars
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={diversify}
                  onChange={(e) => setDiversify(e.target.checked)}
                  disabled={busy}
                />{' '}
                Diversify context
              </label>
            </div>
          )}
        </form>
        <p className="composer-hint">
          {busy ? (
            <>
              <LoaderCircle size={12} className="spin" /> Running the real pipeline. Timings appear
              when it completes.
            </>
          ) : (
            <>
              <ShieldCheck size={12} />
              {status?.live
                ? 'Verify each answer against its cited passages.'
                : 'Demo retrieves real text with BM25. Enable Ollama or OpenAI for embeddings and generation.'}
            </>
          )}
        </p>
      </div>
    </>
  );
}

export function PipelineInspector({ status, result }) {
  return (
    <aside className="inspector">
      <div className="inspector-title">
        <span>
          <GitBranch size={17} /> Pipeline inspector
        </span>
        <span className="small-badge">{result ? 'LAST RUN' : 'READY'}</span>
      </div>
      <div className="inspector-intro">
        <h3>
          No hidden steps.
          <br />
          Just a clear process.
        </h3>
        <p>
          {result
            ? 'Measured stages from your completed request.'
            : 'Every stage is visible, from the first search to the final reference check.'}
        </p>
      </div>
      <div className="trace">
        {(
          result?.trace || [
            { name: 'Retrieve evidence', description: 'Find useful chunks from your documents.' },
            { name: 'Rank & select', description: 'Balance relevance and context diversity.' },
            { name: 'Build context', description: 'Fit sources within an explicit budget.' },
            { name: 'Generate answer', description: 'Ground the response in retrieved text.' },
            { name: 'Validate references', description: 'Check source labels before returning.' },
          ]
        ).map((step, i) => (
          <div className={`trace-step ${result ? 'complete' : ''}`} key={step.name}>
            <span className="trace-icon">
              {result ? <Check size={11} /> : String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <strong>{step.name}</strong>
              <p>{step.description}</p>
              {result && <span className="trace-time">{step.durationMs.toFixed(2)} ms</span>}
            </div>
          </div>
        ))}
      </div>
      {result && (
        <div className="run-summary">
          <div>
            <span>Candidates</span>
            <b>{result.stats.candidateCount}</b>
          </div>
          <div>
            <span>Selected sources</span>
            <b>{result.stats.selectedCount}</b>
          </div>
          <div>
            <span>Approx. context tokens</span>
            <b>~{result.stats.approximateContextTokens}</b>
          </div>
          <small>Character-based estimate. Actual provider tokens may differ.</small>
          {result.usage && (
            <div>
              <span>Actual input / output</span>
              <b>
                {result.usage.inputTokens} / {result.usage.outputTokens}
              </b>
            </div>
          )}
        </div>
      )}
      <div className="inspector-note">
        <ShieldCheck size={15} />
        <p>Pipeline events are program execution data, not a model’s private reasoning.</p>
      </div>
      <div className="runtime">
        <span className="eyebrow">UNDER THE HOOD</span>
        <div>
          <span>Backend</span>
          <strong>Node.js · Express</strong>
        </div>
        <div>
          <span>Retrieval</span>
          <strong>{status?.live ? 'BM25 + embeddings' : 'BM25 · demo'}</strong>
        </div>
        <div>
          <span>Vector store</span>
          <strong>
            {status?.vectorStore === 'qdrant'
              ? 'Qdrant'
              : status?.live
                ? 'Disk · exact cosine'
                : 'Not used in demo'}
          </strong>
        </div>
        <div>
          <span>Embedding dimensions</span>
          <strong>{status?.dimensions || '—'}</strong>
        </div>
        <div>
          <span>Architecture</span>
          <strong>Modular monolith</strong>
        </div>
      </div>
    </aside>
  );
}
