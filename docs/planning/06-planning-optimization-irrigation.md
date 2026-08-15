# 06. Motor de planificacion, optimizacion y riego

## Separar cuatro problemas

La aplicacion no necesita un unico algoritmo gigante. Necesita cuatro capas con tiempos y responsabilidades distintas:

1. **Geometria**: que objetos se intersectan, cuanto y donde.
2. **Reglas**: si una relacion es valida, advertida o bloqueada.
3. **Optimizacion**: entre muchas ubicaciones validas, cuales cumplen mejor los objetivos.
4. **Explicacion**: por que el sistema tomo o rechazo una decision.

Esta separacion permite que el drag-and-drop responda inmediatamente aunque el solver avanzado este apagado.

## Representacion espacial

### Sitio

- poligono de limite
- poligonos plantables y excluidos
- lineas: muros, redes, bordes y recorridos
- puntos: conexiones, valvulas, ejemplares existentes
- zonas ambientales: sol, viento, drenaje, suelo y pendiente

### Planta

Una planta no es un solo circulo. Puede tener envolventes distintas por etapa:

- huella de instalacion
- copa madura
- separacion horticultural recomendada
- cautela de raiz
- distancia a estructura
- zona de riego

Cada envolvente tiene fuente y severidad. Para visualizacion se puede usar un circulo inicialmente; el modelo debe admitir elipses o formas parametricas.

### Coordenadas y tolerancia

- calculo interno en metros
- tolerancia geometrica explicita, por ejemplo milimetros/centimetros segun origen
- redondeo solo al presentar
- normalizar poligonos y validar auto-intersecciones
- limitar vertices y area maxima por request

## Validacion en drag-and-drop

### Cliente, durante el gesto

- usa un snapshot ligero de limites, obstaculos y radios
- consulta un indice espacial en memoria
- calcula bounds, distancia e interseccion
- colorea verde/amarillo/rojo en menos de 100 ms
- no llama al servidor en cada `pointermove`

### Servidor, al soltar

- valida autorizacion y `base_revision`
- reconstruye geometria canonica
- ejecuta todas las restricciones aplicables
- guarda operacion y issues en una transaccion
- responde con revision nueva o `409`

La misma regla debe compartir codigo, datos de prueba y codigos de issue entre validacion interactiva y validacion de servidor, aun si la implementacion geometrica difiere.

## Tipos de restricciones

### Duras

No pueden ignorarse en una propuesta aprobable sin permiso tecnico explicito:

- fuera del limite del predio/area plantable
- interseccion con estructura o piscina
- zona legal o de seguridad conocida
- especie prohibida/restringida
- datos L2 obligatorios ausentes
- componente hidraulico incompatible con presion/caudal verificados

### Blandas

Se pueden ponderar o aceptar con justificacion:

- preferencia de estilo
- mayor mantenimiento
- distancia recomendada no critica
- agua sobre objetivo
- simetria, repeticion o vista
- disponibilidad/precio

### Informativas

- crecimiento esperado
- epoca de floracion
- periodo de establecimiento
- datos con baja confianza

## Del greedy actual al solver

### Etapa 1: heuristica mejorada

Mantener rapidez y simplicidad:

- ordenar por restriccion, no solo tamano
- generar puntos candidatos en bordes, grids adaptativos y alrededor de features
- probar multiples ordenes/seeds
- aplicar mejora local: swap, move, remove/replace
- devolver varias soluciones y descomponer score

Esto puede producir un salto importante antes de introducir un solver formal.

### Etapa 2: modelo discreto con OR-Tools CP-SAT

Discretizar posiciones candidatas a una resolucion compatible con el nivel de precision. Variables binarias indican si una instancia ocupa un candidato. Restricciones impiden pares incompatibles y controlan cantidades, zonas, locks y cobertura.

Objetivo ponderado de ejemplo:

```text
maximizar
  satisfaccion_de_objetivos
  + compatibilidad_de_estilo
  + valor_ecologico
  + cobertura/privacidad
  - consumo_de_agua
  - costo_inicial
  - mantenimiento
  - penalizaciones_blandas
```

CP-SAT trabaja con enteros, por lo que distancias/objetivos se escalan y discretizan. No debe venderse como optimizacion continua exacta. Es adecuado para seleccion/asignacion con restricciones una vez generados candidatos.

### Etapa 3: geometria continua o hibrida

Solo si la investigacion muestra que la discretizacion produce layouts pobres:

- solver discreto elige zonas y combinaciones
- mejora local continua ajusta coordenadas
- Shapely/GEOS valida geometria exacta
- se conservan timeouts y primera solucion factible

No introducir un optimizador no lineal antes de tener un benchmark real.

## Funcion objetivo configurable

Los pesos deben derivarse de prioridades visibles, con presets:

- bajo riego
- presupuesto controlado
- maxima sombra
- nativo/biodiversidad
- bajo mantenimiento
- fidelidad a wishlist

No permitir que un peso convierta una restriccion dura en penalizacion barata. El score se devuelve descompuesto para explicar tradeoffs.

## Explicaciones

Cada issue o sugerencia debe responder:

1. que objeto y regla participan
2. valor observado y limite
3. severidad
4. fuente/confianza
5. acciones que realmente resolverian el problema

Ejemplo estructurado:

```json
{
  "code": "PLANT_STRUCTURE_CLEARANCE",
  "severity": "blocking",
  "objects": ["layout-item-42", "site-feature-house"],
  "observed_m": 1.4,
  "required_m": 2.0,
  "overlap_geometry": {},
  "actions": ["move", "replace_with_compact", "request_exception"]
}
```

El texto se genera desde este contenido; no se almacena como unica verdad.

## Cuando un conjunto no cabe

El sistema debe distinguir:

- imposible por geometria
- incompatible con ambiente
- supera presupuesto/agua/mantenimiento
- no encontro solucion antes del timeout
- faltan datos

Para resolver, ofrecer en orden:

1. mover elementos no bloqueados
2. reducir cantidad no protegida
3. cambiar etapa/tamano comercial sin engañar sobre tamano maduro
4. reemplazar por equivalente funcional
5. relajar preferencia blanda con consentimiento
6. solicitar revision profesional

"Timeout" nunca debe mostrarse como "no cabe".

## Riego: modelo recomendado

El valor fijo `liters_per_week` debe reemplazarse por un calculo transparente basado en clima y cobertura.

Modelo conceptual mensual:

```text
ET_plant_mm = ETo_mm * K_plant * K_density * K_microclimate
net_liters = max(0, (ET_plant_mm - effective_rain_mm) * area_m2)
gross_liters = net_liters / irrigation_efficiency
```

Un milimetro sobre un metro cuadrado equivale a un litro. Para el rango se varian ETo, coeficientes, area de copa y eficiencia dentro de limites documentados.

### Inputs minimos para L1

- comuna/estacion climatica de referencia
- mes o escenario estacional
- area/cobertura por hidrozona
- coeficiente vegetal revisado como rango
- densidad y microclima estimados
- eficiencia por tipo de emisor
- lluvia efectiva estimada
- etapa: establecimiento o madura

### Inputs adicionales para L2

- caudal y presion dinamica
- fuente y capacidad
- topografia
- emisores y caudal unitario
- simultaneidad de zonas
- perdida de carga, diametros y longitudes
- regulacion, filtrado y backflow cuando corresponda

La aplicacion L1 puede sugerir zonas y demanda. No debe emitir un diseno hidraulico ejecutable sin L2.

## Hidrozonas

Agrupar por:

- demanda similar
- exposicion/microclima
- tipo de emisor
- etapa de establecimiento
- restricciones de caudal
- independencia operacional util

El objetivo no es solo minimizar agua; tambien evitar mezclar una especie de alta demanda con una de baja demanda en la misma zona.

## Tarifas de agua en Chile

El modelo no es `m2 por litro`. La necesidad se calcula desde area y evapotranspiracion; la tarifa se aplica al volumen facturado en `m3`.

La estructura debe soportar:

- cargo fijo mensual
- agua potable por `m3`
- periodo punta/no punta
- sobreconsumo sobre umbral
- recoleccion de aguas servidas
- tratamiento/disposicion
- reajustes y vigencias

No asumir que todos los litros de riego reciben identico cargo de alcantarillado ni que el cargo fijo es incremental. La ficha tarifaria debe definir componentes aplicables y el resultado mostrar metodologia.

### Estrategia de actualizacion

1. Resolver proveedor/area desde comuna y poligono de servicio cuando exista.
2. Importar documento o tabla oficial a un staging.
3. Comparar contra version vigente y generar diff.
4. Requerir revision humana para activar.
5. Conservar fuente, archivo, checksum, vigencia y revisor.
6. Recalcular solo borradores; proyectos aprobados conservan su snapshot y muestran disponibilidad de actualizacion.

No depender de scraping fragil como unico camino. Si no existe API estable, construir un adaptador por fuente y una carga administrativa simple.

## Rendimiento

### Interactivo

- bounding boxes antes de geometria exacta
- indice espacial por capa
- validar solo objeto movido y vecinos
- web worker para calculos de cliente costosos
- render por viewport y capas
- no serializar layout completo en cada movimiento

### Backend

- GiST para consultas espaciales que cruzan sitios/areas
- cargar un snapshot de layout una vez por validacion
- Shapely `STRtree` para vecinos dentro de un job
- precalcular candidatos y matrices de incompatibilidad
- cachear por versiones completas
- limitar tiempo, memoria, candidatos y numero de objetos

### Solver

- devolver primera solucion factible y mejorar mientras haya tiempo
- guardar benchmark por tamaño y algoritmo
- fijar seed en tests
- usar perfiles representativos, no microbenchmarks aislados

## Benchmark y calidad del motor

Crear un corpus versionado con:

- patios rectangulares e irregulares
- pocos/muchos obstaculos
- casos factibles conocidos
- casos imposibles conocidos
- layouts aprobados por expertos
- datos incompletos
- limites numericos y geometrias invalidas

Metricas:

- tasa de solucion factible
- tiempo a primera solucion
- diferencia de score
- estabilidad ante cambios pequeños
- restricciones violadas: debe ser cero para duras
- aceptacion/edicion humana del resultado
- porcentaje de explicaciones consideradas utiles

La aceptacion humana importa mas que declarar optimalidad matematica.
