import json
from pathlib import Path


def test_openapi_matches_frozen_v1_contract(tmp_path, monkeypatch):
    """Golden captured from Stage 1 at 4710e12, before retrieval/PCA changes.

    Update the fixture only after explicitly reviewing an intentional API change.
    """
    monkeypatch.setenv("VECTOR_DB_FILE", str(tmp_path / "openapi_vectors.pkl"))
    monkeypatch.setenv("VECTOR_WAL_FILE", str(tmp_path / "openapi_vectors.wal"))

    from main import app

    fixture = Path(__file__).parent / "fixtures" / "openapi_v1.json"
    expected = json.loads(fixture.read_text(encoding="utf-8"))
    assert app.openapi() == expected, (
        "V1 OpenAPI contract changed. Review intentional API changes before explicitly "
        "updating tests/fixtures/openapi_v1.json."
    )
