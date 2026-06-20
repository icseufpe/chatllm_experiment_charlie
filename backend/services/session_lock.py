from __future__ import annotations

import asyncio

_locks: dict[str, asyncio.Lock] = {}


def get_session_lock(session_key: str) -> asyncio.Lock:
    if session_key not in _locks:
        _locks[session_key] = asyncio.Lock()
    return _locks[session_key]
