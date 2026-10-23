import ast
from pathlib import Path

from fastapi.routing import APIRoute, iter_route_contexts

from main import app

SRC = Path(__file__).parents[1] / "src"


def imports(path):
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            yield node.module or ""
            yield from (f"{node.module}.{alias.name}" for alias in node.names)


def test_each_core_http_operation_is_owned_by_its_domain_router():
    expected = {
        "list_documents": "documents",
        "delete_document": "documents",
        "insert_vector": "vectors",
        "clear_user_data": "vectors",
        "delete_vector": "vectors",
        "save_database": "engine",
        "get_db_status": "engine",
        "configure_engine": "engine",
        "search_vectors": "search",
        "search_vectors_by_text": "search",
        "get_vectors_sample": "visualization",
        "get_benchmarks": "benchmarks",
        "ingest_document": "ingestion",
        "ingest_file": "ingestion",
        "ask_question": "rag",
    }
    actual = {
        context.name: context.original_route.endpoint.__module__
        for context in iter_route_contexts(app.routes)
        if isinstance(context.original_route, APIRoute) and context.name in expected
    }
    assert actual == {name: f"api.routers.{domain}" for name, domain in expected.items()}


def test_services_remain_independent_of_http_except_existing_state_singleton():
    forbidden = []
    for path in (SRC / "services").glob("*.py"):
        for module in imports(path):
            if module.startswith(("fastapi", "starlette", "auth.dependencies", "auth.schemas")) or (
                module.startswith("api.") and module != "api.state"
            ):
                forbidden.append((path.name, module))
    assert forbidden == []


def test_http_routers_do_not_import_inference_or_vector_implementations():
    forbidden = []
    for path in (SRC / "api/routers").glob("*.py"):
        for module in imports(path):
            if module.startswith(
                (
                    "ai.",
                    "numpy",
                    "sklearn",
                    "core.indexes",
                    "api.state",
                    "sqlalchemy.select",
                    "sqlalchemy.delete",
                )
            ):
                forbidden.append((path.name, module))
    assert forbidden == []


def test_core_and_database_layers_do_not_depend_on_http_or_services():
    forbidden = []
    for folder in [SRC / "core", SRC / "db"]:
        for path in folder.rglob("*.py"):
            for module in imports(path):
                if module.startswith(("api.", "services", "fastapi", "starlette")):
                    forbidden.append((str(path.relative_to(SRC)), module))
    assert forbidden == []


def test_internal_module_import_graph_has_no_cycles():
    modules = {}
    for path in SRC.rglob("*.py"):
        parts = list(path.relative_to(SRC).with_suffix("").parts)
        if parts[-1] == "__init__":
            parts.pop()
        modules[".".join(parts)] = path
    graph = {
        name: {module for module in imports(path) if module in modules}
        for name, path in modules.items()
    }
    visited = set()

    def visit(name, active):
        assert name not in active, "Import cycle: " + " -> ".join([*active, name])
        if name in visited:
            return
        for child in graph[name]:
            visit(child, [*active, name])
        visited.add(name)

    for name in graph:
        visit(name, [])
