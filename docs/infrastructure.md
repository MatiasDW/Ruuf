# Infrastructure

## Local services

- `frontend`: React + Vite on `5173`
- `backend`: Django + Gunicorn on container port `8000`, host port `5050`
- `worker`: Celery worker with bounded task timeouts
- `postgres`: PostgreSQL 16 on the internal Compose network
- `redis`: password-protected cache, broker, and result backend on the internal network

PostgreSQL and Redis are not exposed to the host. Their passwords and Django's signing key come from ignored `.env` values. Stitch is a design tool and its API key is not passed into runtime containers.

## Initialization

Django migrations own the schema. The backend entrypoint runs:

```text
python manage.py migrate --noinput
python manage.py seed_catalog
```

The seed command is idempotent and marks all starter horticultural data as unverified. SQL init scripts are no longer used.

## Production direction

Use managed PostgreSQL with PostGIS, backups, and point-in-time recovery; managed Redis; private object storage; and separate staging/production secrets. Local Docker stays on the native ARM-compatible PostgreSQL image because the current editor uses local metric coordinates and does not yet execute GIS queries.
