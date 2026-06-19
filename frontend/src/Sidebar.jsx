function Sidebar({ sessions, currentSessionId, onSelectSession, onCreateSession, onDeleteSession }) {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar sidebar" : "Abrir sidebar"}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? (
            <line x1="4" y1="10" x2="16" y2="10" />
          ) : (
            <>
              <line x1="4" y1="10" x2="16" y2="10" />
              <polyline points="12,6 16,10 12,14" />
            </>
          )}
        </svg>
      </button>

      <aside className={`sidebar ${open ? "sidebar--open" : "sidebar--closed"}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Sessoes</span>
          <button className="sidebar-new-btn" onClick={onCreateSession} aria-label="Nova sessao">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="2" x2="8" y2="14" />
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          </button>
        </div>

        <div className="sidebar-list">
          {sessions.length === 0 && (
            <div className="sidebar-empty">Nenhuma sessao ainda</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`sidebar-item ${s.id === currentSessionId ? "sidebar-item--active" : ""}`}
              onClick={() => onSelectSession(s.id)}
            >
              <span className="sidebar-item-title">
                {s.title || "Nova sessao"}
              </span>
              <button
                className="sidebar-item-del"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(s.id);
                }}
                aria-label="Deletar sessao"
                title="Deletar sessao"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="9" y2="9" />
                  <line x1="9" y1="3" x2="3" y2="9" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}