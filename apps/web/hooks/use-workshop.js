import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/** Browser state is presentation state. The backend owns indexing and answer validation. */
export function useWorkshop() {
  const [status, setStatus] = useState(null),
    [documents, setDocuments] = useState([]),
    [topics, setTopics] = useState([]);
  const [result, setResult] = useState(null),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const request = useRef(null);
  const refresh = useCallback(async () => {
    const [health, docs, learning] = await Promise.all([
      api('health'),
      api('documents'),
      api('learn'),
    ]);
    setStatus(health);
    setDocuments(docs);
    setTopics(learning);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    return () => request.current?.abort();
  }, [refresh]);
  async function ask(input) {
    if (busy) return;
    setBusy(true);
    setError('');
    request.current = new AbortController();
    try {
      const answer = await api('queries', { body: input, signal: request.current.signal });
      setResult(answer);
      setHistory((old) => [answer, ...old].slice(0, 8));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setBusy(false);
      request.current = null;
    }
  }
  function clear() {
    setResult(null);
    setError('');
  }
  return {
    status,
    documents,
    topics,
    result,
    setResult,
    history,
    busy,
    error,
    setError,
    refresh,
    ask,
    clear,
  };
}
