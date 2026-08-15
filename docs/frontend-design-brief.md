# Frontend Design Brief

## Estado implementado del flujo

La interfaz ya no concentra intake, plano y recomendaciones en una pantalla. La primera estructura navegable usa cuatro rutas:

| Ruta | Responsabilidad | Comportamiento movil |
|---|---|---|
| `/` | explicar valor y comenzar | hero apilado, CTA de ancho completo |
| `/proyecto` | terreno, casa, ambiente y tarifa opcional | formulario de una columna y accion sticky |
| `/plantas` | catalogo visual y cantidades | tarjetas compactas y filtros con scroll horizontal controlado |
| `/plan` | plano, compatibilidad, riego y costo | SVG responsive, resumen bajo el plano y navegacion inferior |

Dimensiones de referencia:

- desktop de diseño: `1440x900`
- tablet: `768-1024 px`
- movil principal: `390x844`
- movil minimo soportado: `360 px` de ancho
- controles tactiles: minimo `44x44 px`
- safe area inferior respetada por la navegacion movil

Playwright abre las cuatro rutas en desktop y movil. El test falla si existe overflow horizontal o si una vista/navegacion principal deja de estar visible.

## 1. Que es la aplicacion

La aplicacion es un **planificador de paisajismo residencial**.

Su objetivo es ayudar a una empresa o asesor a responder rapidamente:

- que cabe y que no cabe en un patio o jardin
- que especies son compatibles con el espacio y condiciones
- que alternativas conviene proponer si la solicitud no funciona
- como se veria una distribucion inicial
- cuanta agua requeriria el proyecto
- cuanto costaria operar el riego

No es solo un catalogo de plantas. Es una herramienta de **diagnostico, propuesta y pre-cotizacion**.

## 2. Que queremos lograr

Queremos que el usuario sienta que la aplicacion:

- entiende su espacio
- traduce sus gustos en una propuesta concreta
- evita errores de compatibilidad o saturacion
- muestra rapidamente una solucion visual
- explica por que algo no funciona
- propone mejores alternativas sin friccion

En terminos de negocio, queremos acortar el tiempo entre:

1. levantar informacion del cliente
2. generar una propuesta inicial
3. pasar a cotizacion o asesor comercial

## 3. Quien usa el producto

Hay dos escenarios posibles.

### Escenario A: uso asistido por vendedor o paisajista

Este deberia ser el foco inicial.

El cliente conversa con un asesor, y el asesor usa la herramienta para:

- ingresar el sitio
- cargar preferencias
- validar factibilidad
- mostrar una propuesta visual

Esto reduce la complejidad de la interfaz porque no todo tiene que ser self-service perfecto desde el dia uno.

### Escenario B: uso directo por cliente final

Esto puede venir despues, pero exige:

- mucha mas guia
- mejor manejo de errores
- lenguaje menos tecnico
- onboarding mas claro

## 4. Que informacion si necesitamos pedirle al cliente

Para un MVP, lo minimo util es:

### Datos del espacio

- ancho y largo aproximado del patio o jardin
- ubicacion de la casa o volumen construido dentro del terreno
- existencia de zonas no plantables
  - terraza
  - quincho
  - piscina
  - estacionamiento
  - senderos

### Condiciones ambientales

- nivel de sol
  - pleno sol
  - media sombra
  - sombra
- ciudad o comuna
  - importante a futuro para clima y agua

### Preferencias del cliente

- estilo deseado
  - mediterraneo
  - nativo
  - formal
  - frondoso
- nivel de mantencion aceptable
  - bajo
  - medio
  - alto
- preferencia de consumo de agua
  - bajo
  - medio
  - no importa
- especies deseadas
  - arboles
  - arbustos
  - flores
  - o especies especificas si ya las tiene en mente

### Restricciones comerciales

- presupuesto orientativo
- urgencia del proyecto

## 5. Que informacion NO deberiamos pedirle al cliente al inicio

Esto es importante para el diseño. Si pedimos demasiado, el usuario abandona.

No deberiamos exigir de entrada:

- tarifa de agua exacta
- metros cuadrados exactos al centimetro
- coordenadas tecnicas de cada obstaculo
- especies botanicas exactas
- requerimientos de riego en litros
- detalles de tuberias o emisores

Eso lo puede resolver el sistema, el asesor, o una etapa posterior.

## 6. Que puede calcular o decidir el sistema sin pedirselo al cliente

El backend ya esta orientado a tomar decisiones como:

- si una planta cabe o no
- si una planta necesita demasiado espacio libre
- si una especie no calza con sol o estilo
- que alternativas mas compactas o de menor agua sugerir
- una distribucion inicial sobre el terreno
- una estimacion de riego y costo mensual

Mas adelante tambien deberia poder resolver:

- tarifas de agua por comuna y proveedor
- recomendacion de sectores de riego
- agrupacion por hidrozonas
- propuesta de presupuesto estimado

## 7. Como deberia interactuar el cliente

La mejor experiencia no es una pantalla enorme llena de inputs.

La mejor experiencia es un flujo guiado por pasos.

### Flujo recomendado

1. Bienvenida y objetivo
2. Datos del espacio
3. Estilo y preferencias
4. Wishlist de plantas
5. Vista previa del plan
6. Ajustes y alternativas
7. Siguiente accion

### Paso 1: Bienvenida

Objetivo:

- explicar en una frase que la herramienta ayuda a planificar un jardin compatible con espacio, estilo y consumo de agua

CTA:

- "Comenzar plan"

### Paso 2: Espacio

UI ideal:

- formulario simple
- mini editor visual de rectangulos
- posibilidad futura de subir croquis o plano

El usuario deberia poder:

- definir el area
- mover o dimensionar la casa
- marcar obstaculos simples

### Paso 3: Preferencias

UI ideal:

- tarjetas visuales de estilos
- chips para mantencion
- selector simple de sol
- prioridad de bajo consumo de agua

### Paso 4: Wishlist

UI ideal:

- selector por categorias
- buscador por especie
- chips con cantidad
- recomendaciones inteligentes desde el inicio

No todo cliente llega con especies exactas. La UI debe permitir:

- "quiero un arbol de sombra"
- "quiero flores"
- "quiero algo de bajo riego"

### Paso 5: Resultado

Esto es la parte mas importante del front.

Hay que mostrar:

- layout del jardin
- que especies fueron ubicadas
- que especies no entraron
- por que no entraron
- alternativas sugeridas
- resumen de riego y costo

### Paso 6: Ajustes

El usuario o asesor deberia poder:

- cambiar cantidades
- sacar especies conflictivas
- probar una alternativa sugerida
- ver el impacto inmediatamente

### Paso 7: Cierre

CTA posibles:

- solicitar propuesta
- agendar asesoria
- descargar resumen
- enviar por correo

## 8. Que nos gustaria mostrar en pantalla

El frontend ideal no solo debe mostrar formulario. Debe mostrar **confianza** y **capacidad de explicacion**.

### Elementos clave de visualizacion

- mapa del patio con la casa y las plantas
- radio o area protegida de cada planta
- colores por tipo o necesidad de agua
- leyenda simple
- panel lateral con resumen del plan
- lista de conflictos y sugerencias

### Informacion que importa en resultados

- estado general
  - cabe todo
  - cabe parcialmente
  - no cabe bien
- numero de elementos solicitados
- numero de elementos colocados
- especies rechazadas
- causa del rechazo
- consumo estimado de agua
- costo mensual estimado

## 9. Que capacidades visuales tenemos ya desde el backend

El frontend no parte desde cero. Ya tenemos varias bases listas:

- catalogo de plantas
- radio de separacion por especie
- distancia minima a estructuras
- compatibilidad por sol
- tags de estilo
- necesidad de agua
- litros estimados por semana
- estimacion de costo mensual
- respuesta estructurada de elementos colocados y no colocados

Esto permite diseñar una UI rica en feedback aunque el motor aun sea MVP.

## 10. Recomendaciones profesionales de diseño

### 1. Diseñar para decision, no para administracion

La pantalla debe ayudar a elegir rapido, no sentirse como un ERP.

### 2. Usar divulgacion progresiva

Primero pedir solo lo esencial.
Despues mostrar opciones avanzadas si hacen falta.

### 3. Priorizar lo visual por sobre lo tabular

El valor del producto esta en que el usuario vea el espacio y entienda el plan.
La tabla puede existir, pero no debe dominar.

### 4. Hacer visible el motivo de los rechazos

No basta decir "no cabe".
Hay que decir:

- necesita mas separacion
- no coincide con el nivel de sol
- choca con la casa
- aumenta demasiado el consumo de agua

### 5. Convertir sugerencias en acciones

Si el sistema propone una alternativa, el usuario deberia poder aplicarla con un click.

### 6. Evitar lenguaje tecnico al cliente final

En vez de:

- clearance radius
- structure offset
- hydrozone

Usar:

- espacio que necesita
- distancia a muros
- grupo de riego

### 7. Dejar espacio para confianza comercial

El producto no solo debe verse bonito.
Debe ayudar a vender.

Por eso conviene mostrar:

- ahorro de agua relativo
- facilidad de mantencion
- compatibilidad con el estilo buscado
- claridad de proxima accion

### 8. Diseñar para escenarios incompletos

Muchos usuarios no tendran toda la informacion.
La UI debe tolerar datos aproximados y seguir siendo util.

## 11. Que preguntas deberia responder el diseño

Antes de diseñar, conviene definir:

- la herramienta es para asesor interno, cliente final, o ambos
- el layout se edita directamente o solo se visualiza
- la salida principal es una propuesta comercial o una herramienta exploratoria
- el usuario subira plano, dibujara terreno, o solo pondra medidas
- queremos una experiencia rapida tipo wizard o una experiencia tipo canvas

## 12. Recomendacion concreta para primera version del front

Yo haria una experiencia en dos paneles:

- izquierda: flujo de datos y preferencias
- derecha: preview del jardin y resultados

Con estas secciones:

1. Espacio
2. Preferencias
3. Plantas deseadas
4. Resultado

Y con estos principios:

- pocas decisiones por bloque
- feedback inmediato
- layout siempre visible
- conflictos muy claros
- CTA comercial al final

## 13. Lo que el diseñador necesita de nosotros

Para diseñar bien, el diseñador deberia recibir:

- objetivo del producto
- perfil del usuario principal
- flujo ideal de uso
- lista de inputs obligatorios y opcionales
- lista de outputs clave
- nivel de precision del MVP
- ejemplos de estados vacios, errores y conflictos
- idea de tono
  - tecnico
  - amigable
  - premium
  - asesor experto

## 14. Resumen corto para compartir

La aplicacion busca ayudar a planificar jardines residenciales de forma guiada. El usuario entrega dimensiones aproximadas, condiciones de sol y preferencias de estilo o especies. El sistema valida que las plantas quepan y sean compatibles, propone una distribucion visual, sugiere reemplazos cuando algo no funciona, y estima riego y costo mensual. El frontend deberia enfocarse en una experiencia visual, guiada y facil de entender, priorizando resultado y explicacion por sobre exceso de formularios.
