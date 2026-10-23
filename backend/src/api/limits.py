"""Single-worker admission policy at the HTTP boundary; no vector state lives here."""

import math
import time
from collections import OrderedDict, deque
from dataclasses import dataclass, field

from fastapi import Depends, HTTPException, Request

from auth.dependencies import get_current_user
from db.models import User


@dataclass
class Budget:
    requests: deque = field(default_factory=deque)
    active: int = 0


class Limiter:
    def __init__(self, clock=time.monotonic, max_entries=4096):
        self.clock = clock
        self.max_entries = max_entries
        self.entries: OrderedDict[tuple, Budget] = OrderedDict()

    def acquire(self, operation, identity, *, maximum, concurrent, window=60):
        # No await in this critical section: V1 runs one event loop/worker.
        now = self.clock()
        key = (operation, identity)
        if key not in self.entries:
            if len(self.entries) >= self.max_entries:
                idle = next((k for k, value in self.entries.items() if not value.active), None)
                if idle is None:
                    self._reject(1)
                del self.entries[idle]
            self.entries[key] = Budget()
        budget = self.entries[key]
        self.entries.move_to_end(key)
        while budget.requests and budget.requests[0] <= now - window:
            budget.requests.popleft()
        if len(budget.requests) >= maximum:
            self._reject(math.ceil(budget.requests[0] + window - now))
        if budget.active >= concurrent:
            self._reject(1)
        budget.requests.append(now)
        budget.active += 1
        return budget

    def release(self, budget):
        budget.active -= 1

    @staticmethod
    def _reject(seconds):
        raise HTTPException(
            status_code=429,
            detail="Request limit reached. Please retry later.",
            headers={"Retry-After": str(max(1, seconds))},
        )


# Public IP churn cannot evict authenticated users' counters.
auth_limiter = Limiter()
user_limiter = Limiter()


def _user_guard(operation, maximum, concurrent):
    async def guard(current_user: User = Depends(get_current_user)):
        budget = user_limiter.acquire(
            operation, current_user.id, maximum=maximum, concurrent=concurrent
        )
        try:
            yield
        finally:
            user_limiter.release(budget)

    guard.__name__ = f"{operation}_limit"
    return guard


def _ip_guard(operation, maximum, concurrent):
    async def guard(request: Request):
        address = request.client.host if request.client else "unknown"
        budget = auth_limiter.acquire(operation, address, maximum=maximum, concurrent=concurrent)
        try:
            yield
        finally:
            auth_limiter.release(budget)

    guard.__name__ = f"{operation}_limit"
    return guard


register_limit = _ip_guard("register", 5, 1)
login_limit = _ip_guard("login", 10, 4)
ingestion_limit = _user_guard("ingestion", 10, 1)
rag_limit = _user_guard("rag", 30, 2)
search_limit = _user_guard("search", 120, 4)
benchmark_limit = _user_guard("benchmark", 6, 1)
vector_insert_limit = _user_guard("vector_insert", 60, 2)
visualization_limit = _user_guard("visualization", 60, 2)
operator_limit = _user_guard("operator", 6, 1)
