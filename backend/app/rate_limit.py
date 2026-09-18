import time
from collections import deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """How many times a caller may do something inside a rolling window.

    In process and per worker, so two workers allow twice this. That is the
    right trade for a single container: no redis to run, and the numbers here
    are set low enough that even a few workers leave guessing hopeless.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if not hits:
            # nothing left in the window, stop holding the key at all
            del self._hits[key]
            hits = self._hits.setdefault(key, deque())
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True

    def tracked_keys(self) -> int:
        return len(self._hits)

    def clear(self) -> None:
        self._hits.clear()


def caller(request: Request) -> str:
    # nginx is the only thing that reaches this now, so its forwarded address is
    # the real caller. run without a proxy and there is no header to spoof through
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce(limiter: RateLimiter, key: str, retry_after: int) -> None:
    if limiter.allow(key):
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="too many attempts, try again shortly",
        headers={"Retry-After": str(retry_after)},
    )
