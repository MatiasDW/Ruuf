# Backend Scripts

Utilidades y scripts de inicialización para la BD y aplicación.

## Inicialización de BD y permisos (management commands)

Comandos Django idempotentes; se ejecutan durante la provisión y pueden repetirse.

### `python manage.py init_db`
Inicialización de PostgreSQL: extensiones (`uuid-ossp`, `pg_trgm`, `unaccent`) y
usuarios con privilegios mínimos. Requiere conexión con privilegios de creación
(el usuario `ruuf` de docker-compose, o un superuser temporal en managed Postgres).

Usuarios (se omiten si su variable de contraseña no está definida):
- `ruuf_migrate` (`DB_MIGRATION_PASSWORD`): migraciones Django, DDL sobre `public`
- `ruuf_runtime` (`DB_RUNTIME_PASSWORD`): aplicación, solo SELECT/INSERT/UPDATE/DELETE

```bash
docker compose exec backend python manage.py init_db
```

### `python manage.py init_groups`
Crea tres grupos con permisos DRF:
- **admin**: acceso completo (add, change, delete, view) en todos los modelos
- **asesor**: diseño (view, change) + finanzas (view, edit cotizaciones)
- **cliente**: solo lectura (view) en proyecto, sitio, presupuesto, cotización

```bash
docker compose exec backend python manage.py init_groups
```

## Workflow típico

### Desarrollo local

```bash
# 1. Copiar entorno
cp .env.example .env
# Generar valores únicos:
openssl rand -hex 24  # POSTGRES_PASSWORD, REDIS_PASSWORD
openssl rand -hex 48  # DJANGO_SECRET_KEY

# 2. Levantar stack
make docker-up

# 3. Inicializar datos
docker exec damascus-backend-1 python manage.py seed_demo
docker exec damascus-backend-1 python manage.py init_groups

# 4. Verificar
curl http://localhost:5050/api/health
```

### Production (Railway/RDS) — DBA-103

```bash
# 1. Provisionar DB administrado (se hace via Terraform o MCP)
# 2. Conectarse con usuario superuser temporal
# 3. Ejecutar en orden:
python manage.py init_db                    # Roles, extensiones, permisos
python manage.py migrate --noinput          # Schema Django
python manage.py seed_catalog               # Datos horticultores
python manage.py init_groups                # Grupos y permisos DRF
# 4. Revocar usuario superuser temporal
```

## Referencias

- `docs/infrastructure.md`: Arquitectura de roles, multi-tenant, auditoría
- `CLAUDE.md`: Reglas hard (no hardcodear passwords, repo público)
- `.context/loop/PLAN-DE-TRABAJO.md`: Plan maestro, dependencias entre tareas
