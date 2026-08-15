PYTHON ?= .venv/bin/python
NPM ?= npm

.PHONY: help install backend-install frontend-install format format-check lint typecheck test build check audit \
	backend-format backend-format-check backend-lint backend-typecheck backend-test backend-check \
	backend-schema \
	frontend-format frontend-format-check frontend-lint frontend-typecheck frontend-test frontend-e2e frontend-build frontend-check \
	backend-migrations backend-migrate backend-seed backend-shell docker-build docker-up docker-down docker-logs

help:
	@printf '%s\n' \
		'make install       Install backend and frontend dependencies' \
		'make format        Format Python and TypeScript sources' \
		'make check         Run format, lint, type, test, and build checks' \
		'make frontend-e2e  Test all views at desktop and mobile sizes' \
		'make audit         Audit Python and npm production dependencies' \
		'make backend-migrate Apply Django database migrations' \
		'make backend-seed  Seed the provisional plant catalog' \
		'make docker-up     Build and start the local stack'

install: backend-install frontend-install

backend-install:
	$(PYTHON) -m pip install --no-user -r backend/requirements-dev.txt

frontend-install:
	cd frontend && $(NPM) ci

format: backend-format frontend-format

format-check: backend-format-check frontend-format-check

lint: backend-lint frontend-lint

typecheck: backend-typecheck frontend-typecheck

test: backend-test frontend-test

build: frontend-build

check: backend-check frontend-check

audit:
	PIP_USER=false $(PYTHON) -m pip_audit -r backend/requirements.txt
	cd frontend && $(NPM) audit --omit=dev --audit-level=high

backend-format:
	$(PYTHON) -m ruff format backend
	$(PYTHON) -m ruff check --fix backend

backend-format-check:
	$(PYTHON) -m ruff format --check backend

backend-lint:
	$(PYTHON) -m ruff check backend

backend-typecheck:
	$(PYTHON) -m mypy backend

backend-test:
	$(PYTHON) -m pytest --cov=backend --cov-report=term-missing

backend-migrations:
	$(PYTHON) backend/manage.py makemigrations --check --dry-run

backend-schema:
	$(PYTHON) backend/manage.py spectacular --file /tmp/ruuf-openapi.yml --validate --fail-on-warn

backend-migrate:
	$(PYTHON) backend/manage.py migrate

backend-seed:
	$(PYTHON) backend/manage.py seed_catalog

backend-shell:
	$(PYTHON) backend/manage.py shell

backend-check: backend-format-check backend-lint backend-typecheck backend-migrations backend-schema backend-test

frontend-format:
	cd frontend && $(NPM) run format

frontend-format-check:
	cd frontend && $(NPM) run format:check

frontend-lint:
	cd frontend && $(NPM) run lint

frontend-typecheck:
	cd frontend && $(NPM) run typecheck

frontend-test:
	cd frontend && $(NPM) run test

frontend-e2e:
	cd frontend && $(NPM) run test:e2e

frontend-build:
	cd frontend && $(NPM) run build

frontend-check: frontend-format-check frontend-lint frontend-typecheck frontend-test frontend-build

docker-build:
	docker compose build

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs --tail=100 -f
