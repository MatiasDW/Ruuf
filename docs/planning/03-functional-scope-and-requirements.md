# 03. Alcance funcional y requisitos

## Priorizacion

- **P0**: indispensable para un piloto seguro y util.
- **P1**: necesario para vender y operar repetidamente.
- **P2**: escala o mejora relevante despues del piloto.
- **P3**: explorar solo con evidencia.

## Capacidades por dominio

| Dominio | Capacidad | Prioridad |
|---|---|---|
| Identidad | Cuenta, login, recuperacion, invitaciones | P0 |
| Organizaciones | Membresias y aislamiento de datos | P0 |
| Proyectos | Crear, guardar, duplicar, archivar | P0 |
| Sitio | Limite, escala, orientacion y obstaculos | P0 |
| Editor | Drag, resize, seleccion, capas, undo/redo | P0 |
| Catalogo | Buscar especies, filtros y fichas | P0 |
| Reglas | Limites, distancias, sol y conflictos | P0 |
| Versionado | Layouts y supuestos inmutables por version | P0 |
| Propuesta | Resumen, advertencias y exportacion | P0 |
| Optimizador | Generar al menos una alternativa factible | P1 |
| Riego | Demanda estacional e hidrozonas conceptuales | P1 |
| Tarifas | Proveedor y reglas versionadas por vigencia | P1 |
| Cotizacion | BOM, mano de obra, margen y aprobacion | P1 |
| Finanzas | Presupuesto, comprometido, real y variacion | P1 |
| Colaboracion | Comentarios, menciones y tareas | P1 |
| Backoffice | Administrar plantas, reglas, tarifas y precios | P1 |
| Plano asistido | Cargar PDF/imagen y calibrar escala | P1 |
| Inventario/proveedor | Disponibilidad y precios externos | P2 |
| Visita de terreno | Captura movil offline y evidencia | P2 |
| Riego tecnico | Red, diametros y calculo hidraulico | P2/L2 |
| Georreferencia | Parcela/mapa y capas publicas | P2 |
| Visualizacion 3D | Render conceptual | P3 |
| Vision computacional | Extraer limite/objetos de imagen | P3 |

## Requisitos P0 detallados

### Identidad y organizaciones

- Un usuario puede pertenecer a una o mas organizaciones.
- Cada request autenticado resuelve una organizacion activa.
- Ningun identificador enviado por cliente basta para autorizar acceso.
- Clientes externos pueden recibir acceso limitado a proyectos concretos.
- Acciones sensibles quedan en auditoria.

### Proyecto y sitio

- Un proyecto tiene cliente, estado, responsable, moneda, ubicacion aproximada y nivel de precision.
- El sitio acepta limite poligonal, no solo rectangulo.
- Cada feature tiene tipo: construccion, terraza, piscina, sendero, area plantable, area excluida, vegetacion existente, punto de agua u otro.
- La geometria se valida: poligonos cerrados, sin auto-interseccion y con limites de complejidad.
- El usuario puede calibrar un plano indicando la longitud real de un segmento.
- Cambiar escala invalida calculos dependientes y crea una nueva version.

### Catalogo y wishlist

- Se separa especie botanica de producto comercial.
- La wishlist puede expresar especie exacta o intencion funcional.
- Las fichas muestran nombre comun/cientifico, tamano maduro como rango, sol, agua, mantenimiento, riesgos, origen y procedencia.
- Datos sin revision no se usan como restriccion dura.
- El sistema conserva el deseo original aunque sugiera sustitucion.

### Editor y validacion

- Cada elemento colocado tiene posicion, rotacion, tamano/etapa y estado.
- Al mover un elemento, el cliente calcula feedback en menos de 100 ms para un plan normal.
- Al soltar, el servidor valida con las reglas canonicas.
- Los conflictos tienen codigo, severidad, mensaje, geometria afectada, fuente de regla y acciones posibles.
- El usuario puede aceptar una excepcion blanda con motivo; una restriccion dura requiere rol autorizado.
- Undo/redo no crea una llamada por pixel de movimiento; se registra una operacion consolidada al terminar.

### Versiones y aprobacion

- Autosave guarda borradores, pero una version aprobada nunca se modifica.
- Una nueva edicion deriva una version nueva.
- Cada version referencia versiones exactas de catalogo, reglas, clima, tarifa y price book.
- La aprobacion registra usuario, fecha, alcance y nivel L0/L1/L2.
- Cambiar un insumo invalida o marca obsoletos los resultados derivados.

### Propuesta

- El PDF y la vista web comparten los mismos datos de dominio.
- Toda cifra incluye unidad, periodo, moneda y fecha.
- El documento enumera supuestos, exclusiones, pendientes y nivel de confianza.
- La exportacion no expone notas internas ni costos internos por defecto.

## Requisitos P1 detallados

### Optimizacion

- El usuario elige objetivos y prioridades; no se esconde una funcion objetivo fija.
- El solver respeta elementos bloqueados y zonas excluidas.
- Cada ejecucion tiene timeout y puede devolver `feasible`, `infeasible`, `timeout` o `error`.
- Para `infeasible`, se explica el conjunto minimo o aproximado de restricciones responsables.
- Una ejecucion no reemplaza automaticamente la version activa.

### Riego

- Agrupar elementos compatibles en hidrozonas.
- Calcular rango mensual y estacional.
- Separar demanda vegetal, eficiencia y lluvia efectiva.
- Distinguir costo incremental de costo total de boleta.
- No producir diametros o presion final sin datos hidraulicos requeridos.

### Cotizacion y finanzas

- Generar cantidades desde layout aprobado.
- Mapear especies a presentacion comercial, insumos, mano de obra y merma.
- Versionar precios y condiciones.
- Separar costo, precio, margen, IVA y contingencia.
- Registrar ordenes/compromisos y gastos reales con evidencia.
- Requerir cambio aprobado si una optimizacion altera alcance protegido.

## API conceptual

```text
/api/v1/auth/*
/api/v1/organizations/*
/api/v1/clients/*
/api/v1/projects/*
/api/v1/sites/*
/api/v1/site-versions/*
/api/v1/catalog/plants/*
/api/v1/layouts/*
/api/v1/layout-versions/*
/api/v1/layouts/{id}/validate
/api/v1/layouts/{id}/solver-runs
/api/v1/solver-runs/{id}
/api/v1/irrigation-estimates/*
/api/v1/tariffs/*
/api/v1/quotes/*
/api/v1/budgets/*
/api/v1/expenses/*
/api/v1/uploads/*
/api/v1/audit-events/*
```

Los endpoints de movimiento por pixel no son necesarios. El frontend mantiene el gesto y envia la operacion final con `base_version`; el servidor responde con nueva version o conflicto de concurrencia.

## Requisitos no funcionales iniciales

| Area | Objetivo de piloto |
|---|---|
| Disponibilidad | 99,5% mensual para flujo autenticado |
| Respuesta CRUD | p95 menor a 500 ms, excluyendo jobs |
| Validacion de layout | p95 menor a 1 s para 250 elementos |
| Feedback de drag local | menor a 100 ms |
| Solver interactivo | primera solucion util en menos de 10 s; hard timeout configurable |
| Autosave | confirmacion en menos de 2 s en red normal |
| Recuperacion | RPO 24 h y RTO 8 h al inicio; endurecer antes de contratos SLA |
| Accesibilidad | WCAG 2.2 AA en flujos principales |
| Navegadores | ultimas dos versiones estables de Chrome, Safari, Firefox y Edge |
| Movil | intake, revision y comentarios; editor completo optimizado primero para tablet/desktop |
| Localizacion | espanol de Chile, CLP y sistema metrico; arquitectura preparada para i18n |

## Fuera de alcance del MVP

- pagos y conciliacion bancaria
- contabilidad tributaria oficial
- inventario en tiempo real de multiples viveros
- compra automatica
- BIM/CAD bidireccional
- render fotorrealista como fuente de verdad
- deteccion automatica de instalaciones ocultas
- plan de riego L2 sin revision
- marketplace abierto de profesionales

## Criterio para agregar alcance

Una capacidad entra cuando cumple al menos una condicion:

1. desbloquea un gate del roadmap
2. elimina un riesgo de seguridad o calidad
3. aparece repetidamente en sesiones observadas
4. reduce una metrica operacional medible
5. es necesaria para cobrar por el flujo principal

Una idea atractiva sin estas condiciones queda en discovery, no en sprint.
