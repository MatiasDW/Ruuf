# Infrastructure, Roles y Permisos

Ruuf usa un modelo multi-tenant con tres capas de autorización: organizaciones (tenants), membresías con roles organizacionales, y permisos DRF basados en grupos Django.

## Arquitectura multi-tenant

### Organización (`identity.Organization`)
Agrupa usuarios, clientes, proyectos y toda su data bajo un mismo tenant. Campos:
- `name`: Nombre (e.g., "Estudio López Paisajismo")
- `slug`: Identificador único (e.g., "estudio-lopez")
- `currency`: Moneda por defecto (default: "CLP")
- `timezone`: Zona horaria (default: "America/Santiago")
- `retention_days`: Días de retención de auditoría (default: 730)
- `is_active`: Activa/suspendida

### Membresía (`identity.Membership`)
Vincula un usuario a una organización con un rol específico. Campos:
- `user`: FK a User
- `organization`: FK a Organization
- `role`: "owner", "admin", "designer", "finance", "viewer"
- `status`: "invited", "active", "suspended"

Índice compuesto: `(organization, status, role)` para queries rápidas de roles activos.

## Roles organizacionales

Definidos en `identity.models.Membership.Role`:

| Rol | Descripción | Responsabilidades |
|-----|-------------|---|
| **owner** | Propietario de la org | Fundador, máxima autoridad, facturación |
| **admin** | Administrador de equipo | Crear proyectos, gestionar usuarios, acceso a toda data |
| **designer** | Diseñador, asesor de paisajismo | Crear/editar planos, calcular riego, proponer plantas |
| **finance** | Finanzas | Gestionar presupuestos, cotizaciones, reportes de costos |
| **viewer** | Cliente, observador | Lectura: proyecto, presupuesto, plano, cotización |

### Autorización por rol (en `identity.access.py`)

```python
DESIGN_ROLES = {owner, admin, designer}      # Escribe layouts, sites
FINANCE_ROLES = {owner, admin, finance}      # Escribe presupuestos, cotizaciones
ADMIN_ROLES = {owner, admin}                 # Gestiona org, usuarios, miembros
```

Endpoints de API (`api.views`) declaran qué roles pueden escribir:
```python
class LayoutViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES  # Solo owner, admin, designer pueden editar
```

## Grupos Django y Permisos DRF

Complementan los roles organizacionales para futuras integraciones SSO y delegación granular.

Se inicializan con `python manage.py init_groups` (idempotente).

### Grupos aplicacionales

#### `admin`
**Acceso completo** (add, change, delete, view) sobre todos los modelos:
- Organization, Client, Project, User
- Site, SiteVersion, SiteFeature
- Layout, LayoutVersion
- PriceBook, ProjectBudget

**Mapeo de Membership**: owner, admin

#### `asesor`
**Diseño + finanzas** (permisos restringidos):
- Diseño (view, change): Site, SiteVersion, SiteFeature, Layout, LayoutVersion, Project
- Finanzas (view): PriceBook, PriceItem, ProjectBudget, QuoteVersion
- Finanzas (edit): QuoteVersion (add, change)
- Solo lectura: PlantSpecies, IrrigationEstimate

**Mapeo de Membership**: designer, finance

#### `cliente`
**Lectura solamente** (view):
- Project, Site, SiteVersion
- Layout, LayoutVersion
- ProjectBudget, QuoteVersion

**Mapeo de Membership**: viewer

### Inicialización de grupos

```bash
# Desarrollo (local con Docker)
make docker-up
docker exec damascus-backend-1 python manage.py init_groups

# Staging/Production
# Los init scripts corren una sola vez durante provisión en DBA-103.
```

## PostgreSQL: Usuarios y roles

Localización: Docker (dev) o managed Postgres (Railway, RDS en staging/prod).

### Usuarios PostgreSQL

**ruuf** (superuser, solo en docker-compose local)
- Corre migraciones y scripts de inicialización
- Contraseña desde `.env` `POSTGRES_PASSWORD` (nunca tracked)
- No se expone a aplicación en producción

**ruuf_migrate** (futuro, creado por `db_init.py`)
- Solo para correr migraciones Django
- Privilegios: CONNECT, USAGE, ALTER DEFAULT PRIVILEGES
- Contraseña: `DB_MIGRATION_PASSWORD` (.env)

**ruuf_runtime** (futuro, creado por `db_init.py`)
- Usado por backend y workers en producción
- Privilegios mínimos: SELECT, INSERT, UPDATE, DELETE, USAGE
- Contraseña: `DB_RUNTIME_PASSWORD` (.env)

### Extensiones PostgreSQL

Inicializadas en `backend/scripts/init/db_init.py`:

- `uuid-ossp`: Generación de UUIDs v4
- `pg_trgm`: Búsqueda trigram (insensible a orden de palabras)
- `unaccent`: Búsqueda insensible a acentos (chileno: "arbusto" ≈ "arbústo")

## Inicialización local (desarrollo)

```bash
# 1. Setup del entorno
cp .env.example .env
# Generar valores únicos:
openssl rand -hex 24  # POSTGRES_PASSWORD, REDIS_PASSWORD
openssl rand -hex 48  # DJANGO_SECRET_KEY

# 2. Levantar stack
make docker-up

# 3. Ejecutar seed y grupos (en el orden indicado)
docker exec damascus-backend-1 python manage.py seed_demo
docker exec damascus-backend-1 python manage.py init_groups

# 4. Verificar
curl http://localhost:5050/api/health
```

Credenciales demo (ver `backend/identity/management/commands/seed_demo.py`):
- Email: `demo@ruuf.local` (var `DEMO_USER_EMAIL`)
- Password: `<DEMO_USER_PASSWORD>` (env var, nunca default)
- Organization: `Ruuf Demo` (slug: `ruuf-demo`)
- Role: owner

## Auditoría

Cada cambio en modelos core se registra en `audit.AuditEvent`:
- Tabla: `audit_auditevent`
- Campos: `user_id`, `organization_id`, `resource_type`, `action`, `timestamp`, `changes_json`
- Índices: `(organization_id, timestamp)`, `(user_id, timestamp)`

Implementación futura (DBA-102): integración con `django-auditlog`.

## Servicios locales (Docker)

- `frontend`: React + Vite en `5173`
- `backend`: Django + Gunicorn (puerto `8000` dentro, `5050` en host)
- `worker`: Celery con timeouts configurados
- `postgres`: PostgreSQL 16 (red interna, no expuesto)
- `redis`: Cache, broker, result backend (red interna, password-protected)

PostgreSQL y Redis usan passwords desde `.env` (ignorado por Git). Stitch es herramienta de diseño; su API key no se pasa a runtime.

## Migración a Postgres administrado (Railway, RDS)

Plan en `DBA-103`:

1. Provisionar DB administrado (proyecto Railway o RDS)
2. Correr init scripts con superuser temporal:
   - `backend/scripts/init/db_init.py` → extensiones, usuarios, permisos
   - `python manage.py migrate` → schema Django
   - `python manage.py seed_catalog` → catálogo
   - `python manage.py init_groups` → grupos y permisos
3. Cambiar acceso:
   - Backend: `DATABASE_URL` con `ruuf_runtime` (password desde AWS Secrets o Railway KV)
   - Django: vars de entorno para `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`
4. Revocar superuser temporal
5. Activar backups automáticos

## Referencias

- `backend/identity/models.py`: User, Organization, Membership, Client
- `backend/identity/access.py`: DESIGN_ROLES, FINANCE_ROLES, has_organization_role()
- `backend/api/permissions.py`: OrganizationRolePermission (validación en endpoints)
- `backend/scripts/init/db_init.py`: PostgreSQL init (roles, extensiones, permisos)
- `backend/scripts/init/django_groups.py`: Inicialización de grupos Django
- `backend/identity/management/commands/init_groups.py`: Management command
- `.context/loop/PLAN-DE-TRABAJO.md`: DBA-101, DBA-102, DBA-103, SEC-104
