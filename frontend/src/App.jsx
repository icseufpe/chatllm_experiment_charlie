const { useEffect, useMemo, useRef, useState, useCallback } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function App() {
  const [user, setUser] = React.useState(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: createMessageId(),
      role: "assistant",
      content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  // Mantem a ref sincronizada para uso em callbacks assincronas
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Verifica autenticacao ao montar
  useEffect(() => {
    async function check() {
      const u = await authMe();
      setUser(u);
      setCheckingAuth(false);
    }
    check();
  }, []);

  // Carrega sessoes ao montar o componente (so se autenticado)
  useEffect(() => {
    async function init() {
      try {
        const sessionList = await listSessions();
        if (sessionList.length === 0) {
          const newSession = await createSession();
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
        } else {
          setSessions(sessionList);
          setCurrentSessionId(sessionList[0].id);
        }
      } catch (err) {
        setError("Erro ao carregar sessoes: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Carrega mensagens quando a sessao atual muda
  useEffect(() => {
    if (currentSessionId === null) return;
    async function load() {
      try {
        const msgs = await getSessionMessages(currentSessionId);
        setMessages(
          msgs.length > 0
            ? msgs.map((m) => ({
                id: createMessageId(),
                role: m.role,
                content: m.content,
              }))
            : [
                {
                  id: createMessageId(),
                  role: "assistant",
                  content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
                },
              ]
        );
      } catch (err) {
        setError("Erro ao carregar mensagens: " + err.message);
      }
    }
    load();
  }, [currentSessionId]);

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

  const handleAuth = useCallback(async () => {
    const u = await authMe();
    setUser(u);
    // Recarrega sessoes
    try {
      const sessionList = await listSessions();
      if (sessionList.length === 0) {
        const newSession = await createSession();
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      } else {
        setSessions(sessionList);
        setCurrentSessionId(sessionList[0].id);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
    setUser(null);
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([]);
  }, []);

  const onStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  }, []);

  const handleSelectSession = useCallback((sessionId) => {
    if (busy) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
    setError("");
    setCurrentSessionId(sessionId);
    setText("");
  }, [busy]);

  const handleCreateSession = useCallback(async () => {
    if (busy) return;
    try {
      const newSession = await createSession();
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setError("");
      setText("");
    } catch (err) {
      setError("Erro ao criar sessao: " + err.message);
    }
  }, [busy]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    if (busy) return;
    try {
      await deleteSession(sessionId);
      // Recarrega lista do servidor para garantir estado consistente
      const updated = await listSessions();
      setSessions(updated);
      if (currentSessionId === sessionId) {
        if (updated.length > 0) {
          setCurrentSessionId(updated[0].id);
        } else {
          const newSession = await createSession();
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
        }
      }
    } catch (err) {
      setError("Erro ao deletar sessao: " + err.message);
    }
  }, [busy, currentSessionId]);

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

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
    const sid = currentSessionIdRef.current;

    try {
      await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        sessionId: sid,
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
        onDone: async ({ sessionId: returnedSessionId, title }) => {
          // Recarrega a lista de sessoes para pegar o titulo atualizado
          try {
            const freshSessions = await listSessions();
            setSessions(freshSessions);
          } catch {
            // Fallback: atualiza localmente
            if (title) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === returnedSessionId ? { ...s, title } : s
                )
              );
            }
          }
        },
      });

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

  if (checkingAuth) {
    return (
      <main className="app-shell">
        <div className="app-loading">Carregando...</div>
      </main>
    );
  }

  if (!user) {
    return <LoginPage onAuth={handleAuth} />;
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="app-loading">Carregando...</div>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="app-shell">
        <header className="app-header">
          <div className="brand">ChatLLM Lab</div>
          <button className="logout-btn" onClick={handleLogout} title="Sair">
            Sair
          </button>
        </header>

        <section className="messages" aria-live="polite" ref={messagesRef}>
          <div className="messages-inner">
            {messages.length === 0 && (
              <div className="welcome-msg">
                Inicie uma conversa enviando uma mensagem.
              </div>
            )}
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

        <div className="warning-banner">Lembre-se, voce precisa focar no experimento!!!</div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

