function LoginPage({ onAuth }) {
  const [mode, setMode] = React.useState("login"); // "login" | "register"
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await authLogin(trimmedEmail, password);
      } else {
        await authRegister(trimmedEmail, password);
      }
      onAuth();
    } catch (err) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
  };

  return (
    <main className="app-shell">
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">ChatLLM Lab</h1>
          <p className="login-subtitle">
            {mode === "login" ? "Entre com sua conta" : "Crie sua conta"}
          </p>

          {error && <div className="note error">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              className="login-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <input
              className="login-input"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button className="login-btn" type="submit" disabled={busy}>
              {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
            </button>
          </form>

          <p className="login-switch">
            {mode === "login" ? (
              <>
                Nao tem conta?{" "}
                <button className="login-link" onClick={switchMode} disabled={busy}>
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Ja tem conta?{" "}
                <button className="login-link" onClick={switchMode} disabled={busy}>
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}