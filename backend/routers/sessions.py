from __future__ import annotations

import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChatMessage, ChatSession
from backend.schemas.session import (
    MessageCreate,
    MessageResponse,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from backend.services.openrouter import OpenRouterConfigError, generate_reply
from backend.services.session_lock import get_session_lock


MAX_SESSIONS = 100
MAX_TITLE_LENGTH = 80
SESSION_KEY_PREFIX = "session-"

router = APIRouter(prefix="/api")


def generate_session_key() -> str:
    return f"{SESSION_KEY_PREFIX}{secrets.token_hex(12)}"


def get_active_session(db: Session, session_key: str) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.key == session_key, ChatSession.is_deleted.is_(False)).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessao nao encontrada")
    return session


def create_default_title(count: int) -> str:
    return f"New session {count}"


def sanitize_title(title: str) -> str:
    return title.strip()[:MAX_TITLE_LENGTH]


def build_title_prompt(user_message: str) -> str:
    return (
        "Dado o seguinte texto de conversa, gere um titulo curto e apropriado para a sessao: \n"
        f"{user_message}\n"
        "O titulo deve ser breve, explicito e nao deve ser ofensivo. Se nao for possivel gerar um conteudo valido, responda apenas 'New session'."
    )


def build_error_response(exc: Exception, status_code: int):
    return HTTPException(status_code=status_code, detail=str(exc))


def is_default_title(title: str) -> bool:
    return title.strip().startswith("New session")


async def ensure_session_title(session: ChatSession, user_message: str, db: Session) -> None:
    if session.title_manual or (session.title and not is_default_title(session.title)):
        return

    title_prompt = build_title_prompt(user_message)
    reply, _ = await generate_reply(user_message=title_prompt, history=[], model=None)
    generated = reply.strip()

    if not generated or generated.lower().startswith("new session"):
        generated_title = create_default_title(db.query(ChatSession).filter(ChatSession.is_deleted.is_(False)).count() + 1)
    else:
        generated_title = generated[:MAX_TITLE_LENGTH].strip()

    if generated_title:
        session.title = generated_title
        session.title_generated = True
        session.updated_at = datetime.utcnow()
        db.add(session)
        db.commit()
        db.refresh(session)


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionResponse:
    total = db.query(ChatSession).filter(ChatSession.is_deleted.is_(False)).count()
    if total >= MAX_SESSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limite de sessoes atigido")

    if payload.title is not None and len(payload.title.strip()) > MAX_TITLE_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Titulo excede o tamanho maximo")

    title = payload.title.strip() if payload.title else create_default_title(total + 1)
    title_manual = bool(payload.title and payload.title.strip())

    session = ChatSession(
        key=generate_session_key(),
        title=title,
        title_manual=title_manual,
        title_generated=False,
        is_deleted=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return session


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(db: Session = Depends(get_db)) -> list[SessionResponse]:
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.is_deleted.is_(False))
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return sessions


@router.get("/sessions/{session_key}", response_model=SessionResponse)
def read_session(session_key: str, db: Session = Depends(get_db)) -> SessionResponse:
    return get_active_session(db, session_key)


@router.put("/sessions/{session_key}", response_model=SessionResponse)
def update_session(session_key: str, payload: SessionUpdate, db: Session = Depends(get_db)) -> SessionResponse:
    session = get_active_session(db, session_key)
    if payload.title is None:
        return session

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Titulo nao pode ser vazio")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Titulo excede o tamanho maximo")

    session.title = title
    session.title_manual = True
    session.title_generated = False
    session.updated_at = datetime.utcnow()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_key: str, db: Session = Depends(get_db)) -> Response:
    session = get_active_session(db, session_key)
    session.is_deleted = True
    session.deleted_at = datetime.utcnow()
    session.updated_at = datetime.utcnow()
    db.add(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_key}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def post_message(session_key: str, payload: MessageCreate, db: Session = Depends(get_db)) -> MessageResponse:
    session = get_active_session(db, session_key)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mensagem vazia nao permitida")

    session_lock = get_session_lock(session_key)
    async with session_lock:
        if session.title == "" and not session.title_manual:
            try:
                title_prompt = build_title_prompt(content)
                reply, _ = await generate_reply(user_message=title_prompt, history=[], model=None)
                generated = reply.strip()
            except OpenRouterConfigError as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
            except RuntimeError as exc:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

            if not generated or generated.lower().startswith("new session"):
                generated_title = create_default_title(db.query(ChatSession).count() + 1)
            else:
                generated_title = generated[:MAX_TITLE_LENGTH].strip()

            if generated_title:
                session.title = generated_title
                session.title_generated = True
                session.updated_at = datetime.utcnow()
                db.add(session)
                db.commit()
                db.refresh(session)

        message = ChatMessage(
            session_key=session.key,
            role="user",
            content=content,
            model="",
        )
        db.add(message)
        db.commit()
        db.refresh(message)

    return message


@router.get("/sessions/{session_key}/messages", response_model=list[MessageResponse])
def list_session_messages(session_key: str, db: Session = Depends(get_db)) -> list[MessageResponse]:
    get_active_session(db, session_key)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_key == session_key)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages
