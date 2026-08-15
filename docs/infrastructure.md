# Infrastructure

## Services

- `frontend`: React + Vite UI on port `5173`
- `backend`: Flask API on container port `5000`, exposed locally on `5050`
- `postgres`: primary relational store on port `5432`
- `redis`: cache layer on port `6379`

## Postgres init scripts

The Postgres container mounts `infra/postgres/init/` into `/docker-entrypoint-initdb.d`.

Current scripts:

- `01_schema.sql`: creates the `plants` table
- `02_seed_plants.sql`: seeds the starter catalog

These scripts only run automatically when the Postgres data volume is initialized for the first time.

## Redis role

Redis is currently used to cache `POST /api/plan` responses for 5 minutes so repeated planning requests are fast while the optimization logic is still in Python.
