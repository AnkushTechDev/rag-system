import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  FileText,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';

export function Knowledge({ documents, onAdd, refresh, onError }) {
  const [filter, setFilter] = useState(''),
    [selected, setSelected] = useState(null),
    [loading, setLoading] = useState(false),
    [chunkSize, setChunkSize] = useState(700),
    [overlap, setOverlap] = useState(120),
    [rebuilding, setRebuilding] = useState(false);
  async function inspect(id) {
    setLoading(true);
    try {
      setSelected(await api(`documents/${id}`));
    } catch (e) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function rebuild() {
    setRebuilding(true);
    try {
      await api('index/rebuild', { body: { chunkSize, overlap } });
      await refresh();
      setSelected(null);
    } catch (e) {
      onError(e.message);
    } finally {
      setRebuilding(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR SOURCE OF TRUTH
          </div>
          <h1>
            Knowledge base<span>.</span>
          </h1>
          <p>Inspect your documents, their chunk boundaries, and the data behind each answer.</p>
        </div>
        <button className="primary" onClick={onAdd}>
          <Plus size={15} /> Add document
        </button>
      </div>
      <div className="info-banner">
        <BookOpen size={20} />
        <div>
          <strong>Start small. Understand every passage.</strong>
          <p>
            Six synthetic guides are included. Add your own text or Markdown notes to experiment.
          </p>
        </div>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Filter documents"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a document…"
        />
      </label>
      <div className="document-list">
        {documents
          .filter((d) => d.title.toLowerCase().includes(filter.toLowerCase()))
          .map((d) => (
            <button
              key={d.id}
              className="document-row"
              onClick={() => inspect(d.id)}
              disabled={loading}
            >
              <span className="document-icon">
                <FileText size={20} />
              </span>
              <div>
                <h3>{d.title}</h3>
                <p>
                  {d.characters.toLocaleString()} characters · {d.chunks} chunks · {d.chunkSize}/
                  {d.overlap} size/overlap
                </p>
              </div>
              <span className="indexed">
                <span />
                Indexed
              </span>
              <ChevronDown size={14} />
            </button>
          ))}
      </div>
      {loading && <p className="muted">Loading document…</p>}
      {selected && (
        <section className="chunk-explorer">
          <div>
            <h2>{selected.title}</h2>
            <button className="text-button" onClick={() => setSelected(null)}>
              <X size={14} /> Close
            </button>
          </div>
          <p>Offsets refer to the normalized document, in JavaScript UTF-16 character units.</p>
          {selected.chunks.map((c) => (
            <details key={c.id}>
              <summary>
                Chunk {c.index + 1}
                <span>
                  {c.start} → {c.end} · {c.text.length} characters
                </span>
              </summary>
              <p>{c.text}</p>
            </details>
          ))}
        </section>
      )}
      <section className="reindex-panel">
        <div>
          <RotateCcw size={18} />
          <div>
            <h3>Change the chunking strategy</h3>
            <p>Rebuild all documents with new settings. Live mode may need new embedding calls.</p>
          </div>
        </div>
        <div className="reindex-controls">
          <label>
            Chunk size
            <input
              type="number"
              min={100}
              max={2000}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
            />
          </label>
          <label>
            Overlap
            <input
              type="number"
              min={0}
              max={900}
              value={overlap}
              onChange={(e) => setOverlap(Number(e.target.value))}
            />
          </label>
          <button
            className="secondary"
            onClick={rebuild}
            disabled={rebuilding || overlap >= chunkSize / 2}
          >
            {rebuilding ? <LoaderCircle size={14} className="spin" /> : <RotateCcw size={14} />}{' '}
            Rebuild index
          </button>
        </div>
      </section>
    </>
  );
}

/** A focused dialog contains keyboard focus and restores it to the opener on close. */
export function AddDocument({ onClose, onAdded, onError }) {
  const [title, setTitle] = useState(''),
    [content, setContent] = useState(''),
    [chunkSize, setChunkSize] = useState(700),
    [overlap, setOverlap] = useState(120),
    [busy, setBusy] = useState(false);
  const dialog = useRef(null),
    opener = useRef(null);
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.querySelector('input')?.focus();
    return () => opener.current?.focus();
  }, []);
  function trapFocus(event) {
    if (event.key === 'Escape' && !busy) {
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = [
      ...dialog.current.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled)',
      ),
    ];
    const first = elements[0],
      last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('documents', { body: { title, content, chunkSize, overlap } });
      await onAdded();
      onClose();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 120000) {
      onError('File too large; use at most 30,000 characters.');
      return;
    }
    const text = await file.text();
    if (text.length > 30000) {
      onError('Use at most 30,000 characters.');
      return;
    }
    setContent(text);
    if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ''));
  }
  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-dialog-title"
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close add document"
          disabled={busy}
        >
          <X size={19} />
        </button>
        <span className="eyebrow">BUILD YOUR KNOWLEDGE BASE</span>
        <h2 id="document-dialog-title">Give your questions some context.</h2>
        <p>
          Paste notes or import a .txt / .md file. Parsing PDFs and OCR are intentionally outside
          this demo.
        </p>
        <form onSubmit={submit}>
          <label>
            Document title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My notes on vector search"
              maxLength={120}
              required
            />
          </label>
          <label>
            Document content
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste at least 30 characters of useful content…"
              rows={7}
              minLength={30}
              maxLength={30000}
              required
            />
          </label>
          <label className="file-import">
            <Upload size={14} /> Import text or Markdown
            <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importFile} />
          </label>
          <div className="chunk-inputs">
            <label>
              Chunk size (characters)
              <input
                type="number"
                min={100}
                max={2000}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Overlap (characters)
              <input
                type="number"
                min={0}
                max={900}
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value))}
                required
              />
            </label>
          </div>
          <div className="modal-footer">
            <span>{content.length.toLocaleString()} / 30,000 characters</span>
            <button
              className="primary"
              type="submit"
              disabled={
                busy || content.trim().length < 30 || !title.trim() || overlap >= chunkSize / 2
              }
            >
              {busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}{' '}
              {busy ? 'Indexing…' : 'Index document'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
