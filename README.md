# Ruuf Landscape Planner

Ruuf is a residential landscaping planner with a responsive React editor and a persistent Django backend. It captures a property, plant wishlist, environmental constraints, irrigation assumptions, and project costs; then it produces a versioned layout with explicit fit issues.

## What works now

- responsive customer flow at `/`, `/proyecto`, `/plantas`, and `/plan`
- provisional catalog of trees, shrubs, flowers, and grasses
- deterministic placement with yard, obstacle, sunlight, and plant-spacing checks
- structured conflict rings for drag-and-drop validation
- irrigation volume, efficiency range, and Chilean `CLP/m3` cost estimates
- session authentication with CSRF protection
- organizations and roles: owner, admin, designer, finance, and viewer
- clients, projects, versioned sites, layouts, items, and validation issues
- water providers and versioned tariffs
- price books, quotes, budgets, expenses, and finance summaries
- audit events, Redis cache, and Celery optimization jobs
- Django Admin and validated OpenAPI documentation

The eight seeded plants are explicitly marked `prototype_unverified`; their horticultural values must be reviewed before production recommendations.

## Stack

- Web: React 18, strict TypeScript, Vite
- API: Python 3.12, Django 5.2 LTS, Django REST Framework
- Domain engine: framework-independent Python
- Jobs and cache: Celery + Redis
- Data: PostgreSQL 16 locally; PostgreSQL + PostGIS is the production target
- Runtime: Gunicorn and Docker Compose
- Quality: Ruff, MyPy, Pytest, ESLint, Prettier, Vitest, Playwright, GitHub Actions

## Repository

```text
backend/
  config/           Django settings, URLs, WSGI, ASGI, Celery
  api/              serializers, permissions, routes, API views
  identity/         users, organizations, memberships, clients
  projects/         projects, sites, site versions, features
  catalog/          species, cultivars, versioned rules, seed command
  planning/         layouts, revisions, items, issues, solver jobs
  irrigation/       providers, tariffs, zones, estimates
  finance/          price books, quotes, budgets, expenses
  audit/            append-only domain audit events
  domain/           planning and irrigation engines without Django imports
  tests/            API, permission, persistence, and domain tests
frontend/            React application
docs/planning/        product and architecture decisions
docker-compose.yml    local application stack
Makefile              local and CI command interface
```

## Run with Docker

The local `.env` requires unique values for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `DJANGO_SECRET_KEY`. Real values are ignored by Git; `.env.example` documents the names.

```bash
make docker-up
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5050`
- Health: `http://localhost:5050/api/health`
- API documentation: `http://localhost:5050/api/docs/`
- Django Admin: `http://localhost:5050/admin/`

The backend container applies migrations and runs the idempotent catalog seed before Gunicorn starts. PostgreSQL and Redis are internal-only and are not published to the host.

## Development workflow

Docker is the only Python prerequisite. Backend formatting, linting, type checks, migrations checks, tests, and dependency audits run in the `ruuf-backend-dev` image. No host Python installation or virtual environment is required.

Use Node `22.13.0` from `.nvmrc` for frontend quality commands:

```bash
make install
make check
```

After `make docker-up`, operational Django commands execute inside the running backend container:

```bash
make backend-migrate
make backend-seed
make backend-shell
docker compose exec backend python manage.py createsuperuser
```

## API

Compatibility endpoints used by the current frontend:

- `GET /api/health`
- `GET /api/plants`
- `POST /api/plan`

The persistent API is under `/api/v1/` and covers authentication, organizations, clients, projects, sites, catalog, layouts, validation, solver runs, irrigation, tariffs, quotes, budgets, expenses, and audit events. The canonical contract is generated at `/api/schema/` and rendered at `/api/docs/`.

Project planning is persisted with:

```text
POST /api/v1/projects/{project_id}/generate-plan/
```

Manual drag-and-drop edits create immutable revisions using optimistic concurrency:

```text
POST /api/v1/layouts/{layout_id}/revisions/
{
  "base_revision": 1,
  "items": [{"plant_id": "quillay", "x_m": 4.5, "y_m": 3.2}]
}
```

A stale `base_revision` returns `409 Conflict`. Invalid placements are saved as drafts with structured blocking issues so the UI can display red clearance rings instead of losing the user's edit.

## Quality

```bash
make check
make frontend-e2e
make audit
```

`make check` verifies formatting, lint, static types, pending Django migrations, backend coverage, frontend tests, and the production frontend build. The backend currently has integration coverage for authentication, tenancy, roles, planning persistence, revision conflicts, irrigation, solver execution, finance, and audit history.

## Water pricing

Water is priced by volume, not area. The engine converts plant demand from liters per week to `m3/month`, adjusts for irrigation efficiency, and applies versioned fixed, potable-water, and sewer charges. A future tariff importer must preserve provider source URL, effective dates, review status, and historical versions.
