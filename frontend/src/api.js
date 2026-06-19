const API_BASE = window.location.origin;

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("chatllm_token");
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

function setToken(token) {
  if (token) {
    localStorage.setItem("chatllm_token", token);
  } else {
    localStorage.removeItem("chatllm_token");
  }
}

function _extractError(body) {
  if (!body) return "Erro inesperado";
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.map((d) => d.msg).join("; ");
  }
  return body.message || "Erro inesperado";
}

async function authRegister(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(_extractError(body) || "Erro ao cadastrar");
  }
  const data = await response.json();
  setToken(data.access_token);
  return data;
}

async function authLogin(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(_extractError(body) || "Erro ao fazer login");
  }
  const data = await response.json();
  setToken(data.access_token);
  return data;
}

function authLogout() {
  setToken(null);
}

async function authMe() {
  const token = getToken();
  if (!token) return null;
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

function isAuthenticated() {
  return !!getToken();
}

// ── Chat / Stream ────────────────────────────────────────────────────────────

async function sendMessageStream({ message, history, sessionId, onDelta, onDone, onError, signal }) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ message, history, session_id: sessionId }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(_extractError(body) || "Erro ao enviar mensagem para o servidor.");
  }

  if (!response.body) {
    throw new Error("Streaming nao suportado no ambiente atual.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split("\n")
        .find((part) => part.startsWith("data:"));
      if (!line) continue;

      const payloadText = line.slice(5).trim();
      if (!payloadText) continue;

      let payload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        continue;
      }

      if (payload.error) {
        if (onError) onError(payload.error);
        throw new Error(payload.error);
      }

      if (payload.delta) {
        onDelta(payload.delta);
      }

      if (payload.done) {
        if (onDone) onDone({ sessionId: payload.session_id, title: payload.title });
      }
    }
  }
}

// ── Sessions ─────────────────────────────────────────────────────────────────

async function listSessions() {
  const response = await fetch(`${API_BASE}/api/sessions`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error("Erro ao listar sessoes");
  return response.json();
}

async function createSession() {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: "{}",
  });
  if (!response.ok) throw new Error("Erro ao criar sessao");
  return response.json();
}

async function deleteSession(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Erro ao deletar sessao");
}

async function updateSessionTitle(sessionId, title) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Erro ao atualizar titulo");
  return response.json();
}

async function getSessionMessages(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error("Erro ao carregar mensagens");
  return response.json();
}
