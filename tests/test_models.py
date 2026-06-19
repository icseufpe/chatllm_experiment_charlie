from __future__ import annotations

from datetime import datetime, timezone

from backend.models import ChatMessage, ChatSession


class TestChatMessage:
    def test_create_message_defaults(self, db_session):
        """Deve criar uma mensagem com valores padrao para model e created_at."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        msg = ChatMessage(
            session_id=session.id,
            role="user",
            content="Ola, mundo!",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.id is not None
        assert msg.session_id == session.id
        assert msg.role == "user"
        assert msg.content == "Ola, mundo!"
        assert msg.model == "google/gemma-4-31b-it"
        assert isinstance(msg.created_at, datetime)

    def test_create_message_custom_session(self, db_session):
        """Deve criar uma mensagem com session customizada."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content="Resposta do assistente.",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.session_id == session.id
        assert msg.role == "assistant"

    def test_create_message_custom_model(self, db_session):
        """Deve criar uma mensagem com modelo customizado."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        msg = ChatMessage(
            session_id=session.id,
            role="user",
            content="Teste",
            model="openai/gpt-4o",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.model == "openai/gpt-4o"

    def test_query_by_session_id(self, db_session):
        """Deve filtrar mensagens por session_id."""
        s1 = ChatSession()
        s2 = ChatSession()
        db_session.add_all([s1, s2])
        db_session.commit()
        db_session.refresh(s1)
        db_session.refresh(s2)

        msg1 = ChatMessage(session_id=s1.id, role="user", content="a")
        msg2 = ChatMessage(session_id=s2.id, role="user", content="b")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        results = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.session_id == s1.id)
            .all()
        )
        assert len(results) == 1
        assert results[0].content == "a"

    def test_query_by_role(self, db_session):
        """Deve filtrar mensagens pelo campo role."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        msg1 = ChatMessage(session_id=session.id, role="user", content="pergunta")
        msg2 = ChatMessage(session_id=session.id, role="assistant", content="resposta")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        users = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.role == "user")
            .all()
        )
        assistants = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.role == "assistant")
            .all()
        )

        assert len(users) == 1
        assert len(assistants) == 1
        assert users[0].content == "pergunta"
        assert assistants[0].content == "resposta"

    def test_created_at_auto_set(self, db_session):
        """O campo created_at deve ser preenchido automaticamente com UTC now."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        before = datetime.now(timezone.utc).replace(tzinfo=None)
        msg = ChatMessage(session_id=session.id, role="user", content="timestamp test")
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)
        after = datetime.now(timezone.utc).replace(tzinfo=None)

        assert before <= msg.created_at <= after

    def test_content_persists_long_text(self, db_session):
        """Deve persistir conteudos longos corretamente."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        long_text = "Lorem ipsum " * 200
        msg = ChatMessage(session_id=session.id, role="user", content=long_text)
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.content == long_text
