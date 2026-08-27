# CLAUDE.md — Contexto para agentes

Guía de arranque para cualquier agente que trabaje en este repositorio. Leer esto primero;
después `README.md` (estado implementado) y `docs/planning/` (plan maestro, congelado).

## Qué es Ruuf

Planificador de paisajismo residencial para Chile: captura un terreno y una lista de plantas
deseadas, valida que quepan (límites, distancia a estructuras, espaciado entre plantas, sol),
sugiere alternativas cuando algo no cabe y estima riego y costo mensual de agua con tarifas
volumétricas chilenas (CLP/m³ + cargo fijo). Es una herramienta de diagnóstico, propuesta y
pre-cotización asistida por un asesor; no es CAD ni cálculo hidráulico certificado.

## Stack y arquitectura

- Monolito modular: React 18 + TypeScript estricto + Vite → Django 5.2 + DRF → PostgreSQL 16,
  con Redis (solo cache/colas, nunca fuente de verdad) y Celery.
- Motor de dominio en `backend/domain/` (Python puro, sin imports de Django ni HTTP).
- Frontend en `frontend/src/`: rutas `/`, `/proyecto`, `/plantas`, `/plan`; el editor SVG
  interactivo vive en `frontend/src/features/planner/`.
- Backend por apps: `identity`, `projects`, `catalog`, `planning`, `irrigation`, `finance`,
  `audit`, `api` (serializers/permisos/rutas) y `config`.
- Dos superficies de API: compatibilidad sin auth (`GET /api/plants`, `POST /api/plan`, la que
  usa el frontend hoy) y la API persistente con sesión + CSRF bajo `/api/v1/` (contrato OpenAPI
  en `/api/schema/`, render en `/api/docs/`). Los layouts se versionan con revisiones inmutables:
  el cliente envía `base_revision` y una revisión obsoleta responde `409 Conflict`.

## Cómo trabajar

- Python SOLO vía Docker; nunca crear `.venv`. `make docker-up` levanta el stack local
  (frontend `:5173`, backend `:5050`; ajustables con `BACKEND_PORT`/`FRONTEND_PORT` en `.env`
  porque varios workspaces comparten host).
- Node `22.13.0` (`.nvmrc`) para el frontend.
- `make check` corre todos los gates (formato, lint, tipos, migraciones, tests, build). Los
  agentes usan tests dirigidos al alcance tocado; solo el reviewer corre los gates completos.
- Escaneo de secretos: `tools/security/scan-secrets.sh worktree` (gitleaks vía Docker). El gate
  de CI escanea el diff nuevo; la historia es solo informativa.

## Reglas duras

1. NUNCA hacer stage, commit, push, PR o merge sin autorización explícita del usuario para cada
   acción.
2. El repositorio es público: nunca escribir secretos ni valores reales de `.env` en archivos
   tracked, logs, mensajes o capturas. `.env.example` solo lleva marcadores vacíos.
3. `README.md` y `docs/planning/**` están congelados: solo se editan con una tarea explícita.
4. La validación en el cliente es feedback inmediato; Django es la autoridad al guardar. Las
   revisiones aprobadas son inmutables.
5. El agua se cobra por volumen (CLP/m³), nunca por superficie. Toda tarifa requiere proveedor,
   vigencia y fuente.
6. El plano solo representa geometría ingresada o explícitamente inferida; no inventar piscinas,
   terrazas ni obstáculos.
7. Las 8 plantas seed están marcadas `prototype_unverified`: no son recomendaciones de
   producción.
8. No resetear cambios ajenos: revisar `git status --short` antes de editar; otros agentes
   pueden estar trabajando en el mismo árbol con ownership de rutas disjunto.

## Coordinación multi-agente (Conductor)

El trabajo se orquesta con archivos en `.context/loop/` (gitignored; existen solo en el
workspace del chat coordinador, no en un clone fresco):

- `backlog.md`: cola de tareas con ID, estado, owner, ownership de rutas y prompts listos.
- `handoff.md`: dónde quedó el sistema y el siguiente paso.
- `lessons.md`: lecciones operativas acumuladas.
- `inbox/<TASK-ID>.md`: salida de cada agente hijo — exactamente 4 campos (Objetivo, Archivos
  tocados, Evidencia, Siguiente paso), máximo 120 palabras.

Protocolo: un chat toma un solo ID y su ownership de rutas; al terminar no empieza otra tarea;
solo el planner/coordinador edita `.context/loop/**`. Si partes de cero y no ves `.context/`,
pide al usuario el ID de tu tarea y su prompt antes de tocar código.

## Diseño objetivo del frontend

Los bosquejos aprobados (hechos en Stitch, solo herramienta de diseño, no dependencia runtime)
están en `.context/stitch-reference/` (5 pantallas HTML+PNG) y su análisis tracked en
`docs/frontend-reference-from-mocks.md` y `docs/frontend-design-brief.md`. La meta eventual es un
wizard guiado con un plano ilustrado, chips por categoría y un asistente conversacional. El
editor SVG actual ya implementa la mecánica (drag, teclado, validación, riego L1, undo/redo);
la evolución visual es incremental, sin reescrituras.
