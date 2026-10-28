import { useEffect, useState } from 'react';
import { Check, Download, FlaskConical, LoaderCircle, Play, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';

/** Dataset preparation is real; no progress bars or model outputs pretend training occurred. */
export function FineTuning({ onError }) {
  const [configuration, setConfiguration] = useState(null),
    [jsonl, setJsonl] = useState(''),
    [report, setReport] = useState(null),
    [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('The answer cites S9 but only S1 and S2 were supplied.'),
    [comparison, setComparison] = useState(null),
    [comparing, setComparing] = useState(false);
  useEffect(() => {
    let active = true;
    api('fine-tuning')
      .then((data) => {
        if (active) {
          setConfiguration(data);
          setJsonl(data.sample);
        }
      })
      .catch((e) => onError(e.message));
    return () => {
      active = false;
    };
  }, [onError]);
  async function prepare() {
    setBusy(true);
    setReport(null);
    try {
      setReport(await api('fine-tuning/prepare', { body: { jsonl, seed: '42' } }));
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(text) {
    setJsonl(text);
    setReport(null);
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function compare() {
    setComparing(true);
    setComparison(null);
    try {
      setComparison(await api('fine-tuning/compare', { body: { question } }));
    } catch (e) {
      onError(e.message);
    } finally {
      setComparing(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> TEACH BEHAVIOR. KEEP RETRIEVAL.
          </div>
          <h1>
            Fine-tuning lab<span>.</span>
          </h1>
          <p>Prepare examples, train a local LoRA adapter, then measure what changed.</p>
        </div>
        <span className="mode-pill">Local MLX workflow</span>
      </div>
      <div className="info-banner">
        <FlaskConical size={22} />
        <div>
          <strong>This page prepares data. Training runs separately.</strong>
          <p>
            RAG supplies evidence at inference time. Fine-tuning learns behavior from input/output
            examples. No weights are trained by opening this tab or validating a dataset.
          </p>
        </div>
      </div>
      <div className="finetune-concepts">
        <article>
          <span>RAG</span>
          <h3>Bring the right information.</h3>
          <p>Retrieve documents and place evidence in the prompt. Model weights stay unchanged.</p>
        </article>
        <article>
          <span>SUPERVISED FINE-TUNING</span>
          <h3>Demonstrate the right response.</h3>
          <p>Train on prompts and target answers. Our example teaches structured support triage.</p>
        </article>
        <article>
          <span>LoRA / QLoRA</span>
          <h3>Update small adapter matrices.</h3>
          <p>
            Keep the base weights frozen. A quantized base reduces memory; learned adapters still
            require real optimization.
          </p>
        </article>
      </div>
      <section className="fine-section">
        <div className="fine-section-title">
          <div>
            <span className="eyebrow">01 · PREPARE</span>
            <h2>A dataset you can inspect.</h2>
          </div>
          <button
            className="text-button"
            onClick={() => edit(configuration?.sample || '')}
            disabled={!configuration || busy}
          >
            <RotateCcw size={13} /> Restore sample
          </button>
        </div>
        <p className="fine-help">
          32 synthetic single-turn examples. Each JSONL row contains system, user, and target
          assistant messages. A shared group keeps scenario paraphrases in the same split.
        </p>
        <label className="dataset-label" htmlFor="training-data">
          Training examples (JSONL)
        </label>
        <textarea
          id="training-data"
          className="dataset-editor"
          value={jsonl}
          onChange={(e) => edit(e.target.value)}
          spellCheck={false}
          rows={10}
          maxLength={180000}
        />
        <div className="dataset-actions">
          <span>{jsonl.length.toLocaleString()} / 180,000 characters · seed 42</span>
          <div>
            <button
              className="secondary"
              onClick={() => download('dataset.jsonl', jsonl)}
              disabled={!jsonl}
            >
              <Download size={13} /> Raw dataset
            </button>
            <button className="primary" onClick={prepare} disabled={busy || !jsonl}>
              {busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Validate &
              split
            </button>
          </div>
        </div>
        {report && (
          <div className="dataset-report" role="status">
            {!report.valid ? (
              <>
                <h3>Fix these issues before training</h3>
                <ul>
                  {report.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3>
                  <Check size={15} /> Dataset prepared · model not trained
                </h3>
                <div className="metric-grid">
                  {['train', 'valid', 'test'].map((split) => (
                    <article key={split}>
                      <span>{split.toUpperCase()}</span>
                      <strong>{report.counts[split]}</strong>
                      <p>{report.groupCounts[split]} independent groups</p>
                      <button
                        className="text-button"
                        onClick={() => download(`${split}.jsonl`, report.files[`${split}.jsonl`])}
                      >
                        <Download size={12} /> Download JSONL
                      </button>
                    </article>
                  ))}
                </div>
                <p className="fingerprint">
                  Dataset fingerprint: {report.fingerprint.slice(0, 20)}…
                </p>
              </>
            )}
            <ul className="dataset-warnings">
              {report.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="fine-section">
        <div className="fine-section-title">
          <div>
            <span className="eyebrow">02 · TRAIN</span>
            <h2>Run real optimization on your Mac.</h2>
          </div>
        </div>
        <p className="fine-help">
          Apple Silicon + Python 3.11+. Install the optional MLX environment once. Preparing data is
          offline; training can download model weights and use substantial memory.
        </p>
        <pre className="command-block">
          <code>{`python3.11 -m venv .venv-finetune
.venv-finetune/bin/python -m pip install -r training/requirements-mlx.txt
npm run finetune:prepare
# Copy the printed directory into RUN below.
# For your edited data, add: -- --input /path/to/dataset.jsonl
npm run finetune:train -- --run RUN
# Review the plan, then explicitly launch:
npm run finetune:train -- --run RUN --execute`}</code>
        </pre>
        <p className="fine-help">
          The default command prints a plan. Only <code>--execute</code> launches the MLX trainer. A
          separate versioned adapter is produced; your RAG document index is not changed.
        </p>
        <details className="training-explainer">
          <summary>What actually changes during LoRA training?</summary>
          <p>
            For a frozen weight matrix W, LoRA learns a low-rank update ΔW = B × A. Backpropagation
            updates the adapter parameters to reduce next-token prediction loss on the demonstrated
            assistant answers. Validation loss helps detect overfitting; the test split stays held
            out until final evaluation. Because the example base is quantized, this workflow uses
            quantized LoRA.
          </p>
          <p>
            Our default is a small 0.5B model and a tiny synthetic dataset for mechanics. It is not
            a quality guarantee or a replacement for a representative dataset and baseline
            evaluation.
          </p>
        </details>
      </section>
      <section className="fine-section">
        <div className="fine-section-title">
          <div>
            <span className="eyebrow">03 · EVALUATE</span>
            <h2>Compare actual base and adapter outputs.</h2>
          </div>
        </div>
        <p className="fine-help">
          This comparison uses the support-triage task above, not RAG answer generation. After
          training, start the two loopback MLX servers described in docs/FINE_TUNING.md. Enable
          comparison in .env and restart the API.
        </p>
        <div className="fine-compare-form">
          <label htmlFor="comparison-question">Support issue</label>
          <textarea
            id="comparison-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={2000}
          />
          <button
            className="primary"
            onClick={compare}
            disabled={!configuration?.comparisonEnabled || comparing || question.trim().length < 3}
          >
            {comparing ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />} Compare
            models
          </button>
          <span>
            {configuration?.comparisonEnabled
              ? 'Calls your configured local model servers.'
              : 'Not configured. No simulated results are shown.'}
          </span>
        </div>
        {comparison && (
          <>
            <div className="finetune-comparison">
              {['base', 'tuned'].map((name) => (
                <article key={name}>
                  <span className="eyebrow">
                    {name === 'base' ? 'BASE MODEL' : 'MODEL + ADAPTER'}
                  </span>
                  <pre>{comparison[name].text}</pre>
                  <p>
                    {comparison[name].schemaValid
                      ? 'Valid task schema'
                      : 'Task schema check failed'}{' '}
                    · factual/category accuracy requires evaluation
                  </p>
                </article>
              ))}
            </div>
            <p className="fine-help">{comparison.note}</p>
          </>
        )}
      </section>
      <section className="learning-path">
        <span className="eyebrow">INTERVIEW CHECKPOINT</span>
        <h3>Fine-tuning and RAG solve different problems.</h3>
        <p>
          Explain SFT versus pretraining, LoRA versus full fine-tuning, overfitting, data leakage,
          and how you would combine a tuned generator with retrieval. A prepared dataset is not a
          trained model, and a lower loss does not by itself prove better answers.
        </p>
        <p>
          Read docs/FINE_TUNING.md for the annotated workflow, serving commands, held-out
          evaluation, and production limitations.
        </p>
      </section>
    </>
  );
}
