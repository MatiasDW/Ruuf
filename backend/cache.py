from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any, Protocol, cast

from redis import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class Cache(Protocol):
    def get_json(self, key: str) -> Any | None: ...

    def set_json(self, key: str, payload: Any, ttl_seconds: int) -> None: ...

    def ping(self) -> bool: ...


class NullCache:
    def get_json(self, _key: str) -> Any | None:
        return None

    def set_json(self, key: str, payload: Any, ttl_seconds: int) -> None:
        del key, payload, ttl_seconds
        return

    def ping(self) -> bool:
        return False


class RedisCache:
    def __init__(self, client: Redis):
        self.client = client

    def get_json(self, key: str) -> Any | None:
        try:
            raw = cast(str | bytes | bytearray | None, self.client.get(key))
        except RedisError as error:
            logger.warning("cache_read_failed", extra={"error_type": type(error).__name__})
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, json.JSONDecodeError) as error:
            logger.warning("cache_decode_failed", extra={"error_type": type(error).__name__})
            return None

    def set_json(self, key: str, payload: Any, ttl_seconds: int) -> None:
        try:
            self.client.setex(key, ttl_seconds, json.dumps(payload))
        except RedisError as error:
            logger.warning("cache_write_failed", extra={"error_type": type(error).__name__})

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except RedisError:
            return False


def build_cache() -> Cache:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return NullCache()

    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        client.ping()
        return RedisCache(client)
    except RedisError as error:
        logger.warning("cache_initialization_failed", extra={"error_type": type(error).__name__})
        return NullCache()


def plan_cache_key(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    return f"plan:{digest}"
