# Architecture

The running application is a modular monolith with asynchronous workers:

```text
React + TypeScript -> Django REST API -> PostgreSQL
                              |       -> Redis cache
                              +------ -> Celery worker
```

## Boundaries

- `identity`: accounts, organizations, memberships, and clients
- `projects`: projects, measured sites, and site features
- `catalog`: botanical identity, cultivars, and versioned rules
- `planning`: immutable layout revisions, items, issues, and solver runs
- `irrigation`: providers, tariff versions, zones, and estimates
- `finance`: price books, quotes, budgets, and expenses
- `audit`: organization-scoped domain events
- `domain`: geometry and irrigation calculations without Django or HTTP imports

React retains immediate editor feedback. Django performs canonical authorization, validation, persistence, and audit. PostgreSQL is the source of truth; Redis contains only cache, queue, and ephemeral coordination data.

## Versioning

Every saved layout edit creates a new `LayoutVersion`. The client sends `base_revision`; Django locks the layout row and returns `409 Conflict` if another edit already advanced it. Previous versions and approved snapshots are never rewritten.

The planning engine remains deterministic and grid-based in this phase. It is suitable for product validation, not a certified landscape or hydraulic design.

The expanded design and production evolution are maintained in [`planning/04-architecture-and-stack.md`](planning/04-architecture-and-stack.md).
