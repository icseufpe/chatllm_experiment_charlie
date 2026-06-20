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
          <button type="button" onClick={startRename} aria-label="Renomear sessão">
            ✏️
          </button>
          <button type="button" onClick={() => onDelete(session.key)} aria-label="Excluir sessão">
            🗑️
          </button>
        </div>
      )}
    </li>
  );
}

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionKey, setSessionKey] = useState("default");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  const chatHistory = useMemo(
    () => messages.filter((msg) => msg.role === "user" || msg.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    fetchLoadSessions();
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, sidebarOpen]);

  const handleSidebarDragStart = (e) => {
    if (e.clientX > 8) return;
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMainPanelDragStart = (e) => {
    if (!sidebarOpen && e.clientX < 8) {
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    // Se a sidebar está fechada e o usuário arrasta da esquerda para a direita, abre
    if (!sidebarOpen && e.clientX > 100) {
      setSidebarOpen(true);
      setIsDragging(false);
    }
    // Se a sidebar está aberta e o usuário arrasta da esquerda para a esquerda, fecha
    if (sidebarOpen && e.clientX < 50) {
      setSidebarOpen(false);
      setIsDragging(false);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const fetchLoadSessions = async () => {
    try {
      const loaded = await fetchSessions();
      setSessions(loaded);
    } catch (err) {
      setError(err.message || "Erro ao carregar sessoes.");
    }
  };

  const selectSession = async (key, sessionsList = sessions) => {
    const found = sessionsList.find((session) => session.key === key);
    if (!found) return;

    setCurrentSession(found);
    setSessionKey(found.key);
    setMessages([]);
    setError("");

    try {
      const loadedMessages = await fetchSessionMessages(key);
      const normalized = loadedMessages.map((msg) => ({
        id: createMessageId(),
        role: msg.role,
        content: msg.content,
      }));
      if (normalized.length === 0) {
        setMessages([
          {
            id: createMessageId(),
            role: "assistant",
            content: "Sessao carregada. Envie a primeira mensagem para gerar o titulo automatico.",
          },
        ]);
      } else {
        setMessages(normalized);
      }
    } catch (err) {
      setError(err.message || "Erro ao carregar mensagens da sessao.");
    }
  };

  const addSession = async () => {
    try {
      const session = await createSession();
      setSessions((prev) => [session, ...prev]);
      selectSession(session.key, [session, ...sessions]);
    } catch (err) {
      setError(err.message || "Erro ao criar sessao.");
    }
  };

  const renameSession = async (key, title) => {
    try {
      const updated = await updateSession(key, title);
      setSessions((prev) => prev.map((session) => (session.key === key ? updated : session)));
      if (currentSession?.key === key) {
        setCurrentSession(updated);
      }
    } catch (err) {
      setError(err.message || "Erro ao renomear sessao.");
    }
  };

  const refreshSession = async (key) => {
    try {
      const updated = await fetchSession(key);
      setCurrentSession(updated);
      setSessions((prev) => prev.map((session) => (session.key === key ? updated : session)));
    } catch {
      // Ignore errors during refresh.
    }
  };

  const removeSession = async (key) => {
    if (!window.confirm("Excluir sessao?")) return;
    try {
      await deleteSession(key);
      const nextSessions = sessions.filter((session) => session.key !== key);
      setSessions(nextSessions);
      if (currentSession?.key === key) {
        setCurrentSession(null);
        setSessionKey("default");
        setMessages([]);
      }
    } catch (err) {
      setError(err.message || "Erro ao excluir sessao.");
    }
  };

  const onStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  };

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    // Se não tem sessão, cria uma automaticamente
    let session = currentSession;
    let finalSessionKey = sessionKey;
    if (!session) {
      try {
        session = await createSession();
        setSessions((prev) => [session, ...prev]);
        setCurrentSession(session);
        finalSessionKey = session.key;
        setSessionKey(session.key);
      } catch (err) {
        setError(err.message || "Erro ao criar sessao.");
        return;
      }
    }

    setError("");
    const userMessage = { id: createMessageId(), role: "user", content: cleaned };
    const assistantMessageId = createMessageId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setText("");
    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await sendMessageStream({
        message: cleaned,
        sessionKey: finalSessionKey,
        history: chatHistory,
        signal: abortController.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `${msg.content}${delta}` }
                : msg
            )
          );
        },
      });

      await refreshSession(finalSessionKey);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        )
      );
    } catch (err) {
      const aborted = err?.name === "AbortError";
      if (!aborted) {
        setError(err.message || "Falha inesperada ao gerar resposta.");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content.trim() ? msg.content : "Nao foi possivel obter resposta do modelo agora." }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && !msg.content.trim()
              ? { ...msg, content: "Resposta interrompida." }
              : msg
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  return (
    <main className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseDown={handleMainPanelDragStart}>
      <button type="button" className="sidebar-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
        ☰
      </button>
      <aside className="sidebar" onMouseDown={handleSidebarDragStart}>
        <div className="sidebar-header">
          <div>
            <div className="sidebar-title">Sessões</div>
            <div className="sidebar-subtitle">Gerencie seus chats</div>
          </div>
          <button type="button" className="button-secondary" onClick={addSession}>
            + Nova
          </button>
        </div>

        <ul className="sessions-list">
          {sessions.map((session) => (
            <SessionItem
              key={session.key}
              session={session}
              active={currentSession?.key === session.key}
              onSelect={selectSession}
              onRename={renameSession}
              onDelete={removeSession}
            />
          ))}
        </ul>
      </aside>

      <section className="main-panel">
        <header className="panel-header">
          <div>
            <div className="panel-title">
              {currentSession ? currentSession.title || "New session" : "Nenhuma sessão selecionada"}
            </div>
            {currentSession?.title_generated ? <div className="panel-badge">Título automático</div> : null}
          </div>
        </header>

        {error && <div className="note error">{error}</div>}

        <section className="messages" aria-live="polite" ref={messagesRef}>
          <div className="messages-inner">
            {messages.map((msg) => (
              <article key={msg.id} className={`bubble ${msg.role}`}>
                <MessageContent content={msg.content} />
              </article>
            ))}
          </div>
        </section>

        <Composer
          text={text}
          busy={busy}
          error={error}
          onChangeText={setText}
          onSubmit={onSubmit}
          onStop={onStop}
        />
      </section>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

