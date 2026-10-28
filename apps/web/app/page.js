'use client';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight, X } from 'lucide-react';
import { useWorkshop } from '../hooks/use-workshop';
import { Sidebar } from '../components/sidebar';
import { Playground, PipelineInspector } from '../components/playground';
import { AddDocument, Knowledge } from '../components/knowledge';
import { FineTuning } from '../components/fine-tuning';
import { Evaluation, Interview } from '../components/learning';

/** Composition-only page. Retrieval logic belongs to the backend/core package, not React. */
export default function Home() {
  const workshop = useWorkshop();
  const [tab, setTab] = useState('lab'),
    [showAdd, setShowAdd] = useState(false);
  const labels = {
    lab: 'Retrieval playground',
    knowledge: 'Knowledge base',
    interview: 'Interview prep',
    evaluation: 'Evaluation lab',
    finetuning: 'Fine-tuning lab',
  };
  function reset() {
    workshop.clear();
    setTab('lab');
  }
  function history(result) {
    workshop.setResult(result);
    setTab('lab');
  }
  return (
    <div className="app-shell">
      <Sidebar
        tab={tab}
        onTab={setTab}
        status={workshop.status}
        history={workshop.history}
        onHistory={history}
        onReset={reset}
        busy={workshop.busy}
      />
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace
            <ChevronRight size={13} />
            <strong>{labels[tab]}</strong>
          </div>
          <div>
            <span className="local-label">
              <span className="status-dot" /> Local development
            </span>
            <button className="text-button" onClick={() => setTab('interview')}>
              <BookOpen size={15} />
              <span>Learning guide</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </header>
        {workshop.error && (
          <div className="error-banner" role="alert">
            <span>{workshop.error}</span>
            <button onClick={() => workshop.setError('')} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        <div className={`content-grid ${tab === 'lab' ? 'with-inspector' : ''}`}>
          <main className="main-content">
            {tab === 'lab' && (
              <Playground
                status={workshop.status}
                result={workshop.result}
                busy={workshop.busy}
                ask={workshop.ask}
                onAdd={() => setShowAdd(true)}
              />
            )}{' '}
            {tab === 'knowledge' && (
              <Knowledge
                documents={workshop.documents}
                onAdd={() => setShowAdd(true)}
                refresh={workshop.refresh}
                onError={workshop.setError}
              />
            )}{' '}
            {tab === 'interview' && <Interview topics={workshop.topics} />}{' '}
            {tab === 'finetuning' && <FineTuning onError={workshop.setError} />}
            {tab === 'evaluation' && <Evaluation onError={workshop.setError} />}
            <footer className="footer">
              <span>
                RAG WORKSHOP <i>v1.0</i>
              </span>
              <span>A little less magic. A lot more understanding.</span>
              <span>
                <span className="status-dot" /> JavaScript, end to end
              </span>
            </footer>
          </main>
          {tab === 'lab' && <PipelineInspector status={workshop.status} result={workshop.result} />}
        </div>
      </div>
      {showAdd && (
        <AddDocument
          onClose={() => setShowAdd(false)}
          onAdded={workshop.refresh}
          onError={workshop.setError}
        />
      )}
    </div>
  );
}
