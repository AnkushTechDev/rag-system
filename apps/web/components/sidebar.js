import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronRight,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Plus,
  ScanSearch,
} from 'lucide-react';
const navigation = [
  { id: 'lab', label: 'Retrieval playground', icon: ScanSearch },
  { id: 'knowledge', label: 'Knowledge base', icon: FileText },
  { id: 'interview', label: 'Interview prep', icon: GraduationCap },
  { id: 'finetuning', label: 'Fine-tuning lab', icon: FlaskConical },
  { id: 'evaluation', label: 'Evaluation lab', icon: LayoutDashboard },
];
export function Sidebar({ tab, onTab, status, history, onHistory, onReset, busy }) {
  return (
    <aside className="sidebar">
      <a href="/" className="brand">
        <span className="brand-mark">
          <Layers3 size={23} />
        </span>
        <span>
          rag<span className="brand-dot">.</span>workshop
          <small>LEARN IT. BUILD IT. EXPLAIN IT.</small>
        </span>
      </a>
      <button className="new-session" onClick={onReset} disabled={busy}>
        <Plus size={16} /> New experiment <span>↗</span>
      </button>
      <div className="nav-label">YOUR WORKSPACE</div>
      <nav>
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            className={`nav-item ${tab === item.id ? 'selected' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {tab === item.id && <ChevronRight size={13} />}
          </button>
        ))}
      </nav>
      <div className="nav-label recent-label">RECENT EXPERIMENTS</div>
      <div className="history">
        {history.length ? (
          history.map((r) => (
            <button key={r.id} onClick={() => onHistory(r)} disabled={busy}>
              <ScanSearch size={13} />
              <span>{r.question}</span>
            </button>
          ))
        ) : (
          <p>
            Ask your first question.
            <br />
            Every experiment starts here.
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="learning-card">
          <BookOpen size={19} />
          <span>DON’T JUST USE RAG.</span>
          <h3>
            Understand the
            <br />
            decisions behind it.
          </h3>
          <p>
            8 concepts. Real code.
            <br />
            Interview-ready explanations.
          </p>
          <button onClick={() => onTab('interview')}>
            Start learning <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="environment">
          <span className="environment-icon">
            <Boxes size={17} />
          </span>
          <div>
            Local learning workspace
            <small>
              <span className="status-dot" />
              {status ? 'API connected' : 'Connecting to API…'}
            </small>
          </div>
        </div>
      </div>
    </aside>
  );
}
