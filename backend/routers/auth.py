from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas.auth import AuthLogin, AuthRegister, AuthToken
from backend.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_user,
    verify_password,
)


router = APIRouter()


@router.post("/api/auth/register", response_model=AuthToken, status_code=201)
def register(payload: AuthRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email ja cadastrado",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return AuthToken(access_token=token, user_id=user.id, email=user.email)


@router.post("/api/auth/login", response_model=AuthToken)
def login(payload: AuthLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )

    token = create_access_token(user.id, user.email)
    return AuthToken(access_token=token, user_id=user.id, email=user.email)


@router.get("/api/auth/me")
def me(user: User = Depends(require_user)):
    return {
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/api/auth/logout")
def logout():
    # Com JWT stateless, o logout é feito no frontend removendo o token.
    # Poderiamos ter uma blacklist, mas para este lab é suficiente.
    return {"message": "Logout realizado com sucesso"}