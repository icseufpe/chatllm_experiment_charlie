function Login({ onLogin }) {
  console.log('[Login] render');
  const { useState } = React;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") {
        const res = await login({ email, password });
        onLogin(res.token);
      } else {
        await register({ email, password });
        const res = await login({ email, password });
        onLogin(res.token);
      }
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div className="login-panel">
      <h3>{mode === "login" ? "Entrar" : "Criar conta"}</h3>
      <form onSubmit={handleSubmit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="senha" />
        <button type="submit">{mode === "login" ? "Entrar" : "Registrar"}</button>
      </form>
      {error && <div className="error">{error}</div>}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Criar conta" : "Voltar para login"}
        </button>
      </div>
    </div>
  );
}

// expose globally so App.jsx can use it without imports
window.Login = Login;
