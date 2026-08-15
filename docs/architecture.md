# Architecture

> This document describes the running prototype. The evaluated production target and incremental migration plan are in [`planning/04-architecture-and-stack.md`](planning/04-architecture-and-stack.md).

## Decision

The product now uses:

- **React + Vite** for the interface
- **Flask** for the planning API
- **Docker Compose** for local orchestration

## Why Flask instead of Django

This project is still validating the domain:

- plant catalog shape
- fit rules
- irrigation rules
- Chilean tariff integration

Flask is sufficient for the current compact API layer around planning logic. The expanded product plan now includes the capabilities that justify an incremental migration to Django:

- user accounts
- back-office plant management
- quoting workflows
- CRM-style project records
- many relational models and admin tooling

## Current request flow

1. React loads `/api/plants`.
2. The user defines the yard, obstacle, style, sunlight, and plant wishlist.
3. React posts the payload to `/api/plan`.
4. Flask runs the landscape planner and irrigation estimate.
5. React renders the layout and cost summary.

## Current limitation

The planner is still a grid-based greedy placer over a rectangular yard. It is an MVP, not a final optimization engine.
