import pytest
from fastapi.routing import APIRoute, iter_route_contexts
from fastapi.testclient import TestClient

from auth.dependencies import bearer_scheme, get_current_user, get_operator_user
from main import app

# Captured from deploy/v1 before introducing the aggregate router.
EXPECTED_ROUTES = [
    ("GET", "/api/v1/documents", "list_documents", get_current_user),
    ("DELETE", "/api/v1/documents/{document_id}", "delete_document", get_current_user),
    ("POST", "/api/v1/insert", "insert_vector", get_current_user),
    ("DELETE", "/api/v1/vectors/all", "clear_user_data", get_current_user),
    ("DELETE", "/api/v1/vectors/{item_id}", "delete_vector", get_current_user),
    ("POST", "/api/v1/save", "save_database", get_operator_user),
    ("POST", "/api/v1/search", "search_vectors", get_current_user),
    ("POST", "/api/v1/search/text", "search_vectors_by_text", get_current_user),
    ("GET", "/api/v1/vectors/sample", "get_vectors_sample", get_current_user),
    ("GET", "/api/v1/benchmark", "get_benchmarks", get_current_user),
    ("GET", "/api/v1/status", "get_db_status", None),
    ("POST", "/api/v1/engine/configure", "configure_engine", get_operator_user),
    ("POST", "/api/v1/ingest", "ingest_document", get_current_user),
    ("POST", "/api/v1/ingest/file", "ingest_file", get_current_user),
    ("POST", "/api/v1/ask", "ask_question", get_current_user),
    ("POST", "/api/v1/auth/register", "register", None),
    ("POST", "/api/v1/auth/login", "login", None),
    ("GET", "/api/v1/auth/me", "get_me", get_current_user),
    ("POST", "/api/v1/conversations", "create_conversation", get_current_user),
    ("GET", "/api/v1/conversations", "list_conversations", get_current_user),
    (
        "GET", "/api/v1/conversations/{conversation_id}/messages",
        "list_messages", get_current_user,
    ),
    ("PATCH", "/api/v1/conversations/{conversation_id}", "update_conversation", get_current_user),
    ("DELETE", "/api/v1/conversations/{conversation_id}", "delete_conversation", get_current_user),
]


def _dependency_calls(dependant):
    for dependency in dependant.dependencies:
        yield dependency.call
        yield from _dependency_calls(dependency)


def test_route_registry_preserves_order_names_methods_and_authentication():
    routes = [
        route for route in iter_route_contexts(app.routes)
        if isinstance(route.original_route, APIRoute)
    ]
    actual = []
    schema = app.openapi()
    for route in routes:
        guard = next(
            (
                dependency.call for dependency in route.dependant.dependencies
                if dependency.call in (get_current_user, get_operator_user)
            ),
            None,
        )
        for method in sorted(route.methods):
            actual.append((method, route.path, route.name, guard))
            operation = schema["paths"][route.path][method.lower()]
            assert operation["operationId"] == (route.operation_id or route.unique_id)
            assert bool(operation.get("security")) == (guard is not None)
        if guard is not None:
            calls = list(_dependency_calls(route.dependant))
            assert get_current_user in calls
            assert bearer_scheme in calls

    assert actual == EXPECTED_ROUTES
    assert len({(method, path) for method, path, _, _ in actual}) == len(actual)


@pytest.mark.parametrize(
    "method,path",
    [(method, path) for method, path, _, guard in EXPECTED_ROUTES if guard is not None],
)
def test_protected_routes_require_jwt(method, path):
    path = path.format(document_id=1, item_id=1, conversation_id=1)
    response = TestClient(app).request(method, path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
