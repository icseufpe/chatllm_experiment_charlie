from __future__ import annotations

from fastapi.testclient import TestClient


def test_session_lifecycle(client: TestClient):
    response = client.post("/api/sessions", json={})
    assert response.status_code == 201
    session = response.json()
    assert session["title"].startswith("New session")
    assert session["title_manual"] is False
    assert session["is_deleted"] is False

    session_key = session["key"]

    response = client.get(f"/api/sessions/{session_key}")
    assert response.status_code == 200
    assert response.json()["key"] == session_key

    response = client.put(f"/api/sessions/{session_key}", json={"title": "Meu titulo"})
    assert response.status_code == 200
    assert response.json()["title"] == "Meu titulo"
    assert response.json()["title_manual"] is True

    response = client.post(f"/api/sessions/{session_key}/messages", json={"content": "Ola mundo"})
    assert response.status_code == 201
    assert response.json()["session_key"] == session_key
    assert response.json()["role"] == "user"

    response = client.get(f"/api/sessions/{session_key}/messages")
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 1
    assert messages[0]["content"] == "Ola mundo"

    response = client.delete(f"/api/sessions/{session_key}")
    assert response.status_code == 204

    response = client.get(f"/api/sessions/{session_key}")
    assert response.status_code == 404
