# 00. Auditoria del estado actual

## Resumen honesto

El repositorio contiene una demostracion funcional de extremo a extremo:

- una interfaz React que captura dimensiones, preferencias y especies
- una API Flask que devuelve ubicaciones y rechazos
- PostgreSQL con un catalogo inicial de ocho plantas
- Redis para cachear resultados durante cinco minutos
- Docker Compose con frontend, backend, base de datos y cache
- una estimacion simple de litros y costo mensual

Eso es valioso porque elimina incertidumbre basica: el concepto puede mostrarse, probarse y discutirse. Sin embargo, la implementacion actual no debe considerarse lista para usuarios reales ni para datos comerciales.

## Lo que se debe conservar

| Componente | Decision | Motivo |
|---|---|---|
| React y Vite | Conservar | La aplicacion es altamente interactiva y encaja bien como SPA |
| Python | Conservar | Es apropiado para geometria, reglas y optimizacion |
| PostgreSQL | Conservar y extender con PostGIS | Sera la fuente de verdad relacional y espacial |
| Redis | Conservar con alcance controlado | Sirve para cache, jobs y locks; no para datos permanentes |
| Docker Compose | Conservar para desarrollo | Hace reproducible el entorno local |
| Funciones puras de `landscape.py` | Extraer y endurecer | Son una buena semilla para un paquete de dominio testeable |
| Contrato de placements/unplaced | Evolucionar | La separacion entre resultado y explicacion es correcta |
| Mock visual del plano | Evolucionar | Comunica mejor el valor que un formulario tradicional |

## Lo que no debe escalar sin cambios

### API

La API acepta JSON sin un esquema formal, accede directamente a claves del payload y no impone limites de tamano, cantidad o rango. Un `plant_id` inexistente o una cantidad extrema puede generar error o trabajo excesivo. CORS esta abierto globalmente y no existen autenticacion, permisos, rate limiting, auditoria ni versionado de API.

### Persistencia

Solo las plantas viven en PostgreSQL. Sitios, proyectos, layouts, versiones, clientes, tarifas, cotizaciones, gastos y decisiones desaparecen al recargar. Los scripts SQL de inicializacion solo corren al crear el volumen y no reemplazan un sistema de migraciones.

### Motor geometrico

El motor actual:

- supone un patio rectangular
- representa obstaculos como rectangulos
- trata cada planta como un circulo fijo
- busca puntos en una grilla desde una esquina
- coloca primero segun un score sencillo
- devuelve la primera solucion factible que encuentra

No representa formas irregulares, pendientes, orientacion, zonas de sol, copa versus raiz, crecimiento, senderos, tuberias ni objetivos esteticos. Una heuristica greedy puede rechazar un conjunto que si cabria con otro orden.

### Riego y costo

La estimacion actual suma un valor fijo de litros semanales por planta. Eso sirve para una demostracion, pero no debe presentarse como calculo agronomico. La demanda debe depender, al menos, de evapotranspiracion de referencia, coeficiente vegetal, area efectiva, etapa de establecimiento, lluvia util y eficiencia del sistema.

El costo actual suma cargo fijo y `CLP/m3`. En Chile tambien pueden intervenir periodo punta/no punta, sobreconsumo y cargos de recoleccion o tratamiento. Ademas, el cargo fijo completo del hogar no siempre es costo incremental atribuible al jardin.

### Frontend

La interfaz comunica una buena direccion visual, pero hoy mezcla configuracion, demo y resultado en una sola pantalla. Faltan:

- persistencia y autosave
- undo/redo
- drag-and-drop con validacion
- seleccion multiple y capas
- accesibilidad por teclado
- estados de permisos y colaboracion
- precision, escala y unidades visibles
- diferenciacion entre dato medido, inferido y estimado
- una vista movil deliberada

### Operacion

No existen pruebas automatizadas del frontend ni del flujo API, y no hay CI, monitoreo, backups probados, gestion de secretos o estrategia de despliegue. La API key de Stitch fue configurada como variable del backend aunque Stitch es una herramienta de diseno y no una dependencia del producto en tiempo de ejecucion.

## Riesgos inmediatos

| Riesgo | Impacto | Accion antes de un piloto externo |
|---|---|---|
| Direcciones y planos de viviendas sin control de acceso | Alto | Autenticacion, autorizacion por objeto y almacenamiento privado |
| Recomendaciones horticulturales sin fuente ni revision | Alto | Procedencia, version, confianza y aprobacion experta |
| Resultado presentado como plano profesional | Alto | Niveles L0/L1/L2 y disclaimer contextual |
| Payloads no validados | Alto | Esquemas, limites, manejo de errores y tests |
| Una organizacion puede ver datos de otra | Alto | Tenant scoping central y pruebas contra IDOR |
| Tarifas desactualizadas | Medio/alto | Versionado por vigencia y revision humana de cambios |
| Cache devuelve un resultado obsoleto | Medio | Incluir versiones de catalogo, reglas y tarifas en la clave |
| Algoritmo lento bloquea HTTP | Medio | Job asincrono con timeout, cuotas y cancelacion |
| Secretos copiados en archivos o logs | Alto | Rotacion y secret manager; no propagar claves innecesarias |

## Veredicto sobre el stack actual

El stack base es correcto; la estructura de aplicacion no es suficiente.

- No hay razon para reemplazar React, Python, PostgreSQL, Redis o Docker.
- Flask sigue siendo adecuado para la demo y puede operar mientras nace la nueva base.
- La cantidad de capacidades administrativas y relacionales justifica migrar temprano a Django, cuando el costo todavia es bajo.
- No se justifican microservicios, Kubernetes, event sourcing ni una base NoSQL.
- PostGIS y un modelo de geometria versionado son mas importantes que agregar IA generativa.

## Deuda que debe congelarse

Hasta que exista el modelo objetivo, no conviene seguir agregando endpoints ad hoc a `backend/app.py` ni columnas directas a `plants`. Las proximas funciones deben construirse detras de contratos versionados y migraciones, aun si el frontend actual se mantiene temporalmente como cliente.
