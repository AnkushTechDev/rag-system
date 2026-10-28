import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Code2,
  GraduationCap,
  LoaderCircle,
  Play,
  Target,
} from 'lucide-react';
import { api } from '../lib/api';

export function Interview({ topics }) {
  const [opened, setOpened] = useState(new Set());
  function toggle(id) {
    setOpened((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> UNDERSTAND IT. THEN EXPLAIN IT.
          </div>
          <h1>
            Interview prep<span>.</span>
          </h1>
          <p>Practice the questions, connect them to code, and defend the tradeoffs.</p>
        </div>
        <span className="mode-pill">8 core concepts</span>
      </div>
      <div className="practice-banner">
        <GraduationCap size={25} />
        <div>
          <strong>Say your answer out loud first.</strong>
          <p>
            Then reveal the explanation. A good answer covers the mechanism, a tradeoff, and a
            concrete example.
          </p>
        </div>
      </div>
      <div className="interview-grid">
        {topics.map((topic) => (
          <article className="interview-card" key={topic.id}>
            <div className="card-top">
              <span className="topic-number">{topic.id}</span>
              <span className="tiny-badge">{topic.level}</span>
            </div>
            <h2>{topic.title}</h2>
            <p className="interview-question">“{topic.question}”</p>
            <button className="text-button" onClick={() => toggle(topic.id)}>
              {opened.has(topic.id) ? 'Hide explanation' : 'Reveal explanation'}
              <ArrowDown size={13} />
            </button>
            {opened.has(topic.id) && (
              <div className="topic-answer">
                <p>{topic.answer}</p>
                <h3>The tradeoff</h3>
                <p>{topic.tradeoff}</p>
                <h3>Try it yourself</h3>
                <p>{topic.exercise}</p>
                <code>
                  <Code2 size={12} />
                  {topic.code}
                </code>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="learning-path">
        <span className="eyebrow">YOUR NEXT STEP</span>
        <h3>Read → experiment → measure → explain.</h3>
        <p>
          Use docs/LEARNING_PATH.md for a seven-session study plan, docs/INTERVIEW_GUIDE.md for
          deeper questions, and docs/CODE_WALKTHROUGH.md to follow every module.
        </p>
      </div>
    </>
  );
}

export function Evaluation({ onError }) {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  async function evaluate() {
    setBusy(true);
    try {
      setResult(await api('evaluations'));
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> MEASURE BEFORE YOU OPTIMIZE
          </div>
          <h1>
            Evaluation lab<span>.</span>
          </h1>
          <p>Separate retrieval quality from the quality of a generated answer.</p>
        </div>
        <button className="primary" onClick={evaluate} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />} Run baseline
        </button>
      </div>
      <div className="info-banner">
        <Target size={21} />
        <div>
          <strong>A small regression set, not a production benchmark.</strong>
          <p>
            12 synthetic questions over the starter documents. Runs BM25 only on your current
            corpus. No model calls or charges.
          </p>
        </div>
      </div>
      {result ? (
        <>
          <div className="metric-grid">
            {[
              {
                label: 'RECALL @ 3',
                value: result.recall,
                description: 'Relevant documents found',
              },
              {
                label: 'MRR @ 3',
                value: result.mrr,
                description: 'Rank of first relevant document',
              },
              { label: 'NDCG @ 3', value: result.ndcg, description: 'Relevance near the top' },
            ].map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value.toFixed(3)}</strong>
                <p>{metric.description}</p>
              </article>
            ))}
          </div>
          <div className="evaluation-table">
            <table>
              <thead>
                <tr>
                  <th>Question / expected source</th>
                  <th>Recall</th>
                  <th>RR</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.question}>
                    <td>
                      <strong>{row.question}</strong>
                      <span>{row.relevant.join(', ')}</span>
                    </td>
                    <td>{row.recall.toFixed(2)}</td>
                    <td>{row.reciprocalRank.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="reference-note">
            Document titles are deduplicated before scoring. The fixtures are synthetic and share
            vocabulary with the sources, so a perfect score is unsurprising. Generation quality is
            not measured here.
          </p>
        </>
      ) : (
        <div className="evaluation-empty">
          <span>
            <Target size={35} />
          </span>
          <h2>
            A good demo answers.
            <br />A good system measures.
          </h2>
          <p>
            Run the baseline to inspect recall, reciprocal rank,
            <br />
            and ranking quality on the included question set.
          </p>
          <button className="secondary" onClick={evaluate} disabled={busy}>
            Run your first evaluation <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
