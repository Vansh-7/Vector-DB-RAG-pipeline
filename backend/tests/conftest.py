import os

import pytest

os.environ.setdefault(
    "VECTOR_DB_FILE",
    "test_vector_database.pkl",
)

os.environ.setdefault(
    "VECTOR_WAL_FILE",
    "test_vector_database.wal",
)


@pytest.fixture(autouse=True)
def isolated_admission_counters():
    from api.limits import auth_limiter, user_limiter

    auth_limiter.entries.clear()
    user_limiter.entries.clear()
    yield
    auth_limiter.entries.clear()
    user_limiter.entries.clear()
