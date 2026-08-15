# Plan maestro: plataforma de paisajismo residencial

Estado: propuesta de arquitectura y producto para validacion

Fecha de corte: 14 de agosto de 2026
Alcance geografico inicial asumido: Chile

## Proposito de esta carpeta

Estos documentos describen como convertir el prototipo actual en una plataforma que permita levantar un terreno, proponer y editar una distribucion de paisajismo, validar restricciones, calcular riego, construir una cotizacion y controlar la rentabilidad del proyecto.

No son una promesa de que todo deba construirse de inmediato. Separan:

- lo que debemos validar antes de invertir
- lo que constituye el producto minimo vendible
- lo que necesita una operacion profesional
- lo que puede postergarse sin debilitar la propuesta de valor

## Decision principal

La recomendacion es **conservar el prototipo como vertical slice**, pero no escalar su estructura actual directamente a produccion.

La arquitectura objetivo debe ser un **monolito modular**, no microservicios:

- React + TypeScript + Vite para la aplicacion web
- Django + Django REST Framework para API, autenticacion, permisos, administracion y flujos operativos
- Python puro para reglas, geometria y optimizacion
- PostgreSQL + PostGIS como fuente de verdad
- Redis para cache, sesiones efimeras, locks y colas
- Celery para optimizaciones, importaciones y generacion de documentos en segundo plano
- almacenamiento compatible con S3 para planos, fotografias, evidencias y PDFs
- Docker Compose para desarrollo local; servicios administrados para produccion

La razon para migrar Flask no es que Flask sea incorrecto. El prototipo ya demuestra que sirve para validar el algoritmo. La razon es que el producto solicitado ahora incluye cuentas, organizaciones, roles, catalogo editable, proyectos versionados, aprobaciones, cotizaciones, gastos, auditoria y geometria espacial. Django reduce codigo propio precisamente en esas areas.

## Limite de responsabilidad del producto

El producto debe distinguir tres niveles de salida:

| Nivel | Nombre | Uso | Puede emitirse automaticamente |
|---|---|---|---|
| L0 | Idea exploratoria | Inspiracion y prueba de preferencias | Si |
| L1 | Anteproyecto y precotizacion | Conversacion comercial y validacion de factibilidad | Si, mostrando supuestos y confianza |
| L2 | Plan tecnico | Construccion, compra e instalacion | Solo despues de revision profesional |

Un plano cargado por el cliente, una medida aproximada o una estimacion climatica no justifican afirmar precision constructiva. Cada resultado debe mostrar fuente, fecha, supuestos, nivel de confianza y si requiere revision.

## Mapa de documentos

1. [Auditoria actual](00-current-state-audit.md): que existe, que sirve y que riesgos tiene.
2. [Vision y principios](01-product-vision-and-principles.md): que producto estamos construyendo y que no es.
3. [Usuarios y experiencia](02-users-journeys-and-experience.md): datos de entrada, recorrido y sensaciones buscadas.
4. [Alcance funcional](03-functional-scope-and-requirements.md): capacidades, prioridades y criterios de aceptacion.
5. [Arquitectura y stack](04-architecture-and-stack.md): estructura objetivo y decisiones tecnologicas.
6. [Datos](05-data-model-and-data-strategy.md): entidades, versionado, procedencia y estrategia de catalogo.
7. [Motor de planificacion](06-planning-optimization-irrigation.md): geometria, restricciones, solver, riego y tarifas.
8. [Seguridad y confiabilidad](07-security-privacy-reliability.md): amenazas, controles, privacidad y operacion.
9. [Roles y gobierno](08-roles-workflows-governance.md): permisos, aprobaciones y responsabilidades.
10. [Finanzas](09-finance-manager-cost-control.md): presupuesto, gastos, margen y optimizacion de costos.
11. [Roadmap y calidad](10-roadmap-delivery-quality.md): fases, dependencias, pruebas y gates.
12. [Descubrimiento](11-open-questions-discovery.md): decisiones que deben resolverse con clientes y expertos.
13. [Fuentes](12-sources-and-research.md): referencias oficiales y supuestos de esta propuesta.

## Orden de lectura recomendado

Para producto y diseno: `01`, `02`, `03`, `11`.

Para ingenieria: `00`, `04`, `05`, `06`, `07`, `10`.

Para operaciones y negocio: `08`, `09`, `10`.
Para revisar decisiones o actualizar datos: `12`.

## Definicion de exito del primer piloto

El primer piloto no necesita producir automaticamente el jardin perfecto. Tiene que demostrar que un asesor puede:

1. levantar un sitio sin entrenamiento tecnico extenso
2. producir una primera propuesta editable en menos tiempo que hoy
3. detectar conflictos reales antes de cotizar
4. explicar cada recomendacion y cada rechazo
5. estimar consumo y costo sin falsa precision
6. convertir el plan aprobado en cantidades, costos y una propuesta comercial
7. conservar versiones, responsables y decisiones del proyecto

Si el piloto no reduce tiempo, errores o retrabajo, agregar mas inteligencia no resolvera el problema principal.
