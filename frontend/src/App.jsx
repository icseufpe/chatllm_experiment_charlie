const { useEffect, useMemo, useRef, useState } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function SessionBadge({ title_generated }) {
  return title_generated ? <span className="session-badge">Automático</span> : null;
}

function SessionItem({ session, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(session.title || "");

  const startRename = () => setEditing(true);
  const cancelRename = () => {
    setDraftTitle(session.title || "");
    setEditing(false);
  };

  const saveRename = () => {
    if (draftTitle.trim()) {
      onRename(session.key, draftTitle.trim());
      setEditing(false);
    }
  };

  return (
    <li className={`session-item ${active ? "active" : ""}`}>
      <button type="button" className="session-select" onClick={() => onSelect(session.key)}>
        <div className="session-title-row">
          <span className="session-title">{session.title || "New session"}</span>
          <SessionBadge title_generated={session.title_generated} />
        </div>
      </button>

      {editing ? (
        <div className="session-inline-edit">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Novo título"
          />
          <button type="button" onClick={saveRename}>
            Salvar
          </button>
          <button type="button" onClick={cancelRename}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="session-actions">
          <button type="button" onClick={startRename} aria-label="Renomear sessao">
            ✏️
          </button>
          <button type="button" onClick={() => onDelete(session.key)} aria-label="Excluir sessao">
            🗑️
          </button>
        </div>
      )}
    </li>
  );
}

function App() {
  console.log("[App] render start");
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionKey, setSessionKey] = useState("default");
  const [messages, setMessages] = useState([]);
  const [token, setToken] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  const chatHistory = useMemo(() => messages.filter((m) => m.role === "user" || m.role === "assistant"), [messages]);

  useEffect(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight; }, [messages]);

  useEffect(() => {
    const stored = localStorage.getItem("chat_token");
    if (stored) {
      setToken(stored);
      fetchSessions().then(setSessions).catch(() => {});
    }
    return () => abortControllerRef.current?.abort();
  }, []);

  const handleLogin = (newToken) => {
    localStorage.setItem("chat_token", newToken);
    setToken(newToken);
    fetchSessions().then(setSessions).catch(() => {});
  };

  const handleLogout = async () => {
    try { await logout(token); } catch {}
    localStorage.removeItem("chat_token");
    setToken(null);
    setSessions([]);
    setCurrentSession(null);
    setMessages([]);
  };

  const selectSession = async (key) => {
    try {
      const s = await fetchSession(key);
      setCurrentSession(s);
      setSessionKey(s.key);
      const msgs = await fetchSessionMessages(key);
      setMessages(msgs.map((m) => ({ id: createMessageId(), role: m.role, content: m.content })));
    } catch (err) {
      setError(err.message || "Erro ao carregar sessao");
    }
  };

  const addSession = async () => {
    try {
      const s = await createSession();
      setSessions((prev) => [s, ...prev]);
      await selectSession(s.key);
    } catch (err) { setError(err.message || "Erro ao criar sessao"); }
  };

  const renameSession = async (key, title) => {
    try { const updated = await updateSession(key, title); setSessions((p) => p.map((s) => s.key === key ? updated : s)); if (currentSession?.key === key) setCurrentSession(updated); } catch (err) { setError(err.message || "Erro ao renomear"); }
  };

  const removeSession = async (key) => {
    if (!confirm("Excluir sessao?")) return;
    try { await deleteSession(key); setSessions((p) => p.filter((s) => s.key !== key)); if (currentSession?.key === key) { setCurrentSession(null); setMessages([]); } } catch (err) { setError(err.message || "Erro ao deletar"); }
  };

  const onStop = () => { abortControllerRef.current?.abort(); abortControllerRef.current = null; setBusy(false); };

  const onSubmit = async (e) => {
    e.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    let finalKey = sessionKey;
    if (!currentSession) {
      try { const s = await createSession(); setSessions((p) => [s, ...p]); setCurrentSession(s); finalKey = s.key; setSessionKey(s.key); } catch (err) { setError(err.message || "Erro ao criar sessao"); return; }
    }

    const userMsg = { id: createMessageId(), role: "user", content: cleaned };
    const assistantId = createMessageId();
    setMessages((p) => [...p, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setText("");
    setBusy(true);
    const controller = new AbortController(); abortControllerRef.current = controller;

    try {
      await sendMessageStream({ message: cleaned, sessionKey: finalKey, history: chatHistory, signal: controller.signal, onDelta: (delta) => {
        setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: `${m.content}${delta}` } : m));
      }});
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      if (!aborted) setError(err.message || 'Erro ao enviar');
      setMessages((p) => p.map((m) => m.id === assistantId && !m.content.trim() ? { ...m, content: aborted ? 'Resposta interrompida.' : 'Falha ao gerar resposta.' } : m));
    } finally {
      abortControllerRef.current = null; setBusy(false);
    }
  };

  if (!token) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Por favor, faça login</h2>
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className={`app-shell ${sessions.length === 0 ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="sidebar-title">Sessoes</div>
            <div className="sidebar-subtitle">ChatLLM Lab</div>
          </div>
          <div>
            <button className="button-secondary" onClick={addSession}>Nova</button>
            <button className="button-secondary" onClick={handleLogout} style={{ marginLeft: 8 }}>Sair</button>
          </div>
        </div>
        <ul className="sessions-list">
          {sessions.map((s) => (
            <SessionItem key={s.key} session={s} active={currentSession?.key === s.key} onSelect={selectSession} onRename={renameSession} onDelete={removeSession} />
          ))}
        </ul>
      </aside>

      <main className="main-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">{currentSession?.title || 'Sem sessao selecionada'}</div>
            {currentSession?.title_generated && <div className="panel-badge">Título automático</div>}
          </div>
        </div>

        <div className="messages" ref={messagesRef}>
          <div className="messages-inner">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                <MessageContent content={m.content} />
              </div>
            ))}
          </div>
        </div>

        <Composer text={text} busy={busy} error={error} onChangeText={setText} onSubmit={onSubmit} onStop={onStop} />
      </main>
    </div>
  );
}

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root && window.ReactDOM && window.React) {
    ReactDOM.createRoot(root).render(React.createElement(App));
  }
});

console.log('[App] script loaded');

