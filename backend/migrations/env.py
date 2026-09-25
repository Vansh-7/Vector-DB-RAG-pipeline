from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from config import settings
from db.base import Base

# Import models so SQLAlchemy registers their tables with Base.metadata.
import db.models  # noqa: F401


# Alembic Config object. Gives access to values in alembic.ini.
config = context.config


# Configure Python logging using alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Alembic uses this metadata when running:
#
# alembic revision --autogenerate
#
# It compares Base.metadata against the actual PostgreSQL schema.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations without creating a live database connection.

    Alembic generates SQL statements using only the database URL.
    Useful for commands that emit SQL rather than execute it directly.
    """
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations against a live PostgreSQL database.

    Alembic itself runs synchronously, so we intentionally create a
    normal synchronous SQLAlchemy engine here even though the FastAPI
    application uses AsyncSession at runtime.
    """
    connectable = create_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()