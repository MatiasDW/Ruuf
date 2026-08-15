from __future__ import annotations

from typing import Any

import pytest
from redis.exceptions import RedisError

from cache import NullCache, RedisCache, build_cache, plan_cache_key


class FakeRedis:
    def __init__(self, value: str | None = None, fail: bool = False) -> None:
        self.value = value
        self.fail = fail
        self.writes: list[tuple[str, int, str]] = []

    def get(self, _key: str) -> str | None:
        if self.fail:
            raise RedisError("read failed")
        return self.value

    def setex(self, key: str, ttl_seconds: int, value: str) -> None:
        if self.fail:
            raise RedisError("write failed")
        self.writes.append((key, ttl_seconds, value))

    def ping(self) -> bool:
        if self.fail:
            raise RedisError("ping failed")
        return True


def test_cache_keys_are_stable_for_equivalent_payloads() -> None:
    first = plan_cache_key({"site": {"width": 5}, "requests": [1, 2]})
    second = plan_cache_key({"requests": [1, 2], "site": {"width": 5}})

    assert first == second
    assert first.startswith("plan:")


def test_redis_cache_reads_and_writes_json() -> None:
    client = FakeRedis('{"fits": true}')
    cache = RedisCache(client)  # type: ignore[arg-type]

    assert cache.get_json("plan:1") == {"fits": True}
    cache.set_json("plan:1", {"fits": False}, ttl_seconds=60)
    assert client.writes == [("plan:1", 60, '{"fits": false}')]
    assert cache.ping()


@pytest.mark.parametrize("value", ["not-json", 12])
def test_redis_cache_ignores_invalid_cached_data(value: Any) -> None:
    cache = RedisCache(FakeRedis(value))  # type: ignore[arg-type]

    assert cache.get_json("plan:1") is None


def test_redis_failures_degrade_without_raising() -> None:
    cache = RedisCache(FakeRedis(fail=True))  # type: ignore[arg-type]

    assert cache.get_json("plan:1") is None
    cache.set_json("plan:1", {}, ttl_seconds=60)
    assert not cache.ping()


def test_build_cache_returns_null_cache_without_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)

    assert isinstance(build_cache(), NullCache)
