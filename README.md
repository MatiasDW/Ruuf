# Ruuf Landscape Planner

This repo uses a **React + TypeScript frontend** and a **Python/Flask backend** to prototype a landscaping planner for residential yards.

The product direction is:

- intake yard measurements
- capture a wishlist of trees, shrubs, flowers, and grasses
- validate fit based on spacing and obstacle clearance
- reject plants that do not match the site or no longer fit
- suggest smaller or lower-water alternatives
- estimate irrigation demand
- estimate water cost in Chile from volumetric tariffs

## Stack

- Frontend: React 18, strict TypeScript, Vite
- Prototype API: Python 3.12, Flask, Pydantic
- Target product backend: Django modular monolith, Django REST Framework, PostGIS
- Orchestration: Docker Compose
- Data: PostgreSQL + Redis
- Quality: Ruff, MyPy, Pytest, ESLint, Prettier, Vitest, GitHub Actions

## Current prototype and target architecture

TypeScript and Django are not alternatives here. TypeScript makes the browser editor and its API contracts safer; Django is the future Python server responsible for permissions, projects, spatial data, approvals, quotes, and audit history. Flask remains a deliberately small API while the planning algorithm and product workflow are validated, then its domain services move behind Django REST Framework without rewriting the React client.

The complete product, technology, data, security, finance, and delivery plan is indexed in [`docs/planning/README.md`](docs/planning/README.md).

## Repo layout

```text
.
├── backend/
│   ├── app.py
│   ├── cache.py
│   ├── catalog.py
│   ├── db.py
│   ├── irrigation.py
│   ├── landscape.py
│   ├── repository.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   └── Dockerfile
├── infra/
├── docs/
├── .context/
├── docker-compose.yml
├── Makefile
└── pyproject.toml
```

The removed root Python files belonged to the original solar-panel packing prototype and are no longer part of the product path.

## Run locally

Use Node `22.13.0` (recorded in `.nvmrc`) and Python `3.12`. The repository exposes the same commands locally and in CI:

```bash
python3.12 -m venv .venv
make install
make check
```

Start services directly when working on one side:

```bash
.venv/bin/python backend/app.py
cd frontend && npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the Flask backend.

Current customer flow:

- `/`: product introduction and start
- `/proyecto`: yard, house, environment, and optional tariff data
- `/plantas`: visual plant catalog and quantities
- `/plan`: responsive SVG plan, compatibility decisions, irrigation, and estimated cost

## Run with Docker

```bash
make docker-up
```

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5050/api/health`
- Postgres: internal Docker network on `postgres:5432`
- Redis: internal Docker network on `redis:6379`

## API endpoints

- `GET /api/health`
- `GET /api/plants`
- `POST /api/plan`

## Database and cache

- Plant catalog records now load from Postgres when available.
- Redis caches planner responses for repeated requests.
- If the backend cannot reach Postgres, it falls back to the in-code seed catalog so the app still boots in degraded mode.

## Engineering quality

`make check` is the required local gate. It verifies Python and TypeScript formatting, lint rules, static types, backend coverage, frontend tests, and the production frontend build. GitHub Actions runs the same targets and then builds every Docker image. `make audit` checks Python and npm production dependencies for known vulnerabilities.

`make frontend-e2e` uses Playwright to open all four routes at `1440x900` and `390x844`, verifies the main content is visible, rejects horizontal overflow, and checks that every mobile navigation destination remains reachable.

Ruff intentionally replaces the older Black + isort + Flake8 combination. One fast tool owns Python formatting and linting, while MyPy remains responsible for static types.

## GitHub automation

GitHub Actions is configured in `.github/workflows/ci.yml`. It starts for pull requests targeting the repository, pushes to `main`, or manual dispatch. It is not active merely because the YAML exists locally: after the workflow is pushed, inspect the repository **Actions** tab or run:

```bash
gh workflow list --repo MatiasDW/Ruuf
gh run list --repo MatiasDW/Ruuf --limit 10
gh run watch --repo MatiasDW/Ruuf
```

Dependabot is configured in `.github/dependabot.yml`. Once that file exists on the default branch, GitHub checks npm, Python, Docker, and Actions dependencies weekly and opens isolated update pull requests. CI then determines whether each update still formats, typechecks, tests, builds, and passes responsive browser checks.

## Pricing note for Chile

The irrigation cost model should be based on **water volume**:

- estimate liters per week
- convert to `m3/month`
- apply provider tariff in `CLP/m3`
- add any fixed monthly charge

Do not model water price as a direct `CLP/m2` input unless it is a derived approximation for a specific scenario.
