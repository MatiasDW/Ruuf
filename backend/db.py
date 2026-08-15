from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine

_engine: Engine | None = None


def get_database_url() -> str | None:
    return os.getenv("DATABASE_URL")


def get_engine() -> Engine | None:
    global _engine

    if _engine is not None:
        return _engine

    database_url = get_database_url()
    if not database_url:
        return None

    _engine = create_engine(database_url, pool_pre_ping=True)
    return _engine


@contextmanager
def db_connection() -> Iterator[Connection | None]:
    engine = get_engine()
    if engine is None:
        yield None
        return

    with engine.connect() as connection:
        yield connection
