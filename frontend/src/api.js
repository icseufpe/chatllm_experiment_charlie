const API_BASE = window.location.origin;

async function sendMessageStream({ message, history, sessionId, onDelta, onDone, onError, signal }) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, session_id: sessionId }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail || "Erro ao enviar mensagem para o servidor.";
    throw new Error(detail);
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

async function listSessions() {
  const response = await fetch(`${API_BASE}/api/sessions`);
  if (!response.ok) throw new Error("Erro ao listar sessoes");
  return response.json();
}

async function createSession() {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("Erro ao criar sessao");
  return response.json();
}

async function deleteSession(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Erro ao deletar sessao");
}

async function updateSessionTitle(sessionId, title) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Erro ao atualizar titulo");
  return response.json();
}

async function getSessionMessages(sessionId) {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
  if (!response.ok) throw new Error("Erro ao carregar mensagens");
  return response.json();
}
