"""
Django management command to initialize PostgreSQL extensions, roles and grants.

Usage: python manage.py init_db

Idempotent: safely run multiple times. Requires a connection with privileges to
create extensions and roles (the docker-compose `ruuf` user, or a temporary
superuser during managed-Postgres provisioning).

Role passwords come from DB_MIGRATION_PASSWORD / DB_RUNTIME_PASSWORD environment
variables; roles whose password variable is unset are skipped, so the command is
safe to run in local development where only the default `ruuf` user exists.
"""

from __future__ import annotations

import os
import re
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

EXTENSIONS = ("uuid-ossp", "pg_trgm", "unaccent")
ROLE_NAME_PATTERN = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


class Command(BaseCommand):
    help = "Initialize PostgreSQL extensions and minimal-privilege application roles."

    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write("🔧 Initializing database...")
        self._init_extensions()
        self._init_roles()
        self.stdout.write(self.style.SUCCESS("✓ Database initialization complete."))

    def _init_extensions(self) -> None:
        with connection.cursor() as cursor:
            for extension in EXTENSIONS:
                cursor.execute(f'CREATE EXTENSION IF NOT EXISTS "{extension}";')
                self.stdout.write(f"✓ Extension {extension}")

    def _init_roles(self) -> None:
        db_name = connection.settings_dict["NAME"]
        roles = [
            (os.getenv("DB_MIGRATION_USER", "ruuf_migrate"), "DB_MIGRATION_PASSWORD", True),
            (os.getenv("DB_RUNTIME_USER", "ruuf_runtime"), "DB_RUNTIME_PASSWORD", False),
        ]
        for role, password_var, is_migration in roles:
            password = os.getenv(password_var)
            if not password:
                self.stdout.write(
                    self.style.WARNING(f"⚠ Skipping role {role}: {password_var} not set")
                )
                continue
            self._ensure_role(role, password)
            self._grant_privileges(role, db_name, is_migration)

    def _ensure_role(self, role: str, password: str) -> None:
        # Los identificadores no admiten placeholders; se valida el nombre antes de
        # interpolarlo para impedir inyección vía variables de entorno.
        if not ROLE_NAME_PATTERN.fullmatch(role):
            raise CommandError(f"Invalid role name: {role!r}")
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s;", [role])
            if cursor.fetchone():
                cursor.execute(f"ALTER ROLE {role} WITH LOGIN PASSWORD %s;", [password])
                self.stdout.write(f"✓ Role {role} already exists; password refreshed")
            else:
                cursor.execute(f"CREATE ROLE {role} WITH LOGIN PASSWORD %s;", [password])
                self.stdout.write(f"✓ Created role {role}")

    def _grant_privileges(self, role: str, db_name: str, is_migration: bool) -> None:
        if not ROLE_NAME_PATTERN.fullmatch(db_name):
            raise CommandError(f"Invalid database name: {db_name!r}")
        with connection.cursor() as cursor:
            cursor.execute(f'GRANT CONNECT ON DATABASE "{db_name}" TO {role};')
            cursor.execute(f"GRANT USAGE ON SCHEMA public TO {role};")
            if is_migration:
                cursor.execute(f"GRANT CREATE ON SCHEMA public TO {role};")
                self.stdout.write(f"✓ Granted schema DDL privileges to {role}")
                return
            cursor.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role};"
            )
            cursor.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role};")
            cursor.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role};"
            )
            cursor.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                f"GRANT USAGE, SELECT ON SEQUENCES TO {role};"
            )
            self.stdout.write(f"✓ Granted runtime privileges to {role}")
