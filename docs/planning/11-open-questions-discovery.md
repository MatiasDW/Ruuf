# 11. Preguntas abiertas y plan de descubrimiento

## Decisiones que cambian el producto

Estas preguntas no deben resolverse solo por preferencia tecnica. Requieren evidencia de negocio, clientes o expertos.

### Mercado y operacion

1. ¿El primer comprador es una empresa de paisajismo, un vivero, una constructora o el dueño de casa?
2. ¿La herramienta se usa en una videollamada/visita o completamente en autoservicio?
3. ¿Quien asume responsabilidad por la propuesta y quien puede aprobar L1/L2?
4. ¿En que comunas/regiones se lanza y por que?
5. ¿El negocio gana por software, asesoria, instalacion, venta de materiales o una combinacion?
6. ¿Que sistema usa hoy para CRM, cotizacion, contabilidad y compras?

### Levantamiento

7. ¿Que precision real tienen las medidas que llegan hoy?
8. ¿Con que frecuencia existe plano, foto aerea, croquis o visita?
9. ¿Que errores del sitio provocan mas retrabajo o costo?
10. ¿La app debe soportar jardin frontal/trasero y multiples zonas desde el piloto?
11. ¿Que formatos de archivo aparecen realmente?
12. ¿Cuando es obligatoria una visita tecnica?

### Paisajismo

13. ¿Que 30-100 especies/cultivares cubren la mayoria de propuestas iniciales?
14. ¿Que restricciones son seguridad versus recomendacion?
15. ¿Como se define "cabe": instalacion, año 3 o madurez?
16. ¿Que reglas cambian por costa, helada, suelo, pendiente o mascota?
17. ¿Que sustituciones son comercial y esteticamente aceptables?
18. ¿Que politica tendra el negocio para nativas e invasoras?

### Riego

19. ¿El resultado esperado es consumo conceptual, hidrozonas o plano hidraulico?
20. ¿Se dispone de caudal y presion antes de cotizar?
21. ¿Que metodo usa hoy el especialista y con que tolerancia?
22. ¿Que fuentes de agua se deben considerar: red, pozo, acumulacion, reutilizacion?
23. ¿El cliente quiere costo incremental de jardin o proyeccion de boleta total?
24. ¿Quien revisa y actualiza tarifas?

### Finanzas y ejecucion

25. ¿Que define el margen objetivo y quien puede verlo?
26. ¿Que partidas generan mayor variacion?
27. ¿Que umbrales exigen aprobacion o change request?
28. ¿Como se registran hoy compras, compromisos, gastos y evidencia?
29. ¿Que sistema contable recibira exportacion?
30. ¿Se cotiza por precio fijo, unitario o administracion?

### Privacidad y seguridad

31. ¿Es indispensable direccion exacta desde el inicio?
32. ¿Cuanto tiempo deben conservarse proyectos, planos y fotos?
33. ¿Clientes externos necesitan cuenta o bastan enlaces temporales?
34. ¿Que regiones alojaran datos y que proveedores tendran acceso?
35. ¿Se planea usar proyectos para entrenar modelos?

## Hipotesis iniciales a validar

| Hipotesis | Señal de confirmacion | Señal de rechazo |
|---|---|---|
| Uso asistido es mejor wedge | Asesor reduce tiempo y cliente entiende | Asesor se vuelve cuello de botella sin valor |
| Drag-and-drop aumenta confianza | Usuarios corrigen/aceptan propuestas | Solo miran imagen o prefieren que experto decida |
| Explicar conflictos mejora conversion | Sustituciones se aplican y se continua | Conflictos causan abandono aunque se expliquen |
| Riego/costo diferencia el producto | Se usa en decision y cotizacion | Se ignora o no se confia en estimacion |
| Catalogo pequeño revisado basta | Cubre mayoria de pilotos | Cada proyecto requiere muchas altas manuales |
| Layout L1 reduce retrabajo | Menos cambios despues de visita | Cambios siguen dominados por datos ausentes |

## Investigacion recomendada

### Entrevistas contextuales

Observar, no solo preguntar. Pedir al asesor que produzca una propuesta real con sus herramientas actuales y narrar:

- que datos busca
- donde duda
- que calcula manualmente
- que reutiliza de proyectos anteriores
- donde pide aprobacion
- que cambia despues de cotizar

### Test de intake

Dar a 5 clientes una propiedad conocida. Medir:

- preguntas que no entienden
- datos que no tienen
- precision que creen estar entregando
- tiempo y abandono
- diferencias contra levantamiento profesional

### Test de editor

Probar tres modelos:

1. propuesta automatica editable
2. lienzo vacio con recomendaciones
3. asesor edita y cliente comenta

Observar quien quiere mover, que significa el anillo y si undo/compare se descubre.

### Evaluacion experta

Con corpus anonimizado, pedir a dos profesionales evaluar ciegamente:

- factibilidad
- calidad compositiva
- errores peligrosos
- tiempo necesario para corregir
- utilidad de explicaciones

### Shadow financiero

Durante el piloto, generar presupuesto del sistema sin usarlo como contractual. Comparar contra proceso real y costo final para calibrar formulas, merma y price book.

## Artefactos de cada estudio

- guion y consentimiento
- notas anonimizadas
- clips solo si fueron autorizados
- observaciones separadas de interpretaciones
- hallazgos con frecuencia/severidad
- decision o experimento siguiente
- fecha de revision

No guardar investigacion sensible indefinidamente ni copiar direcciones/fotos a herramientas no aprobadas.

## Decision log sugerido

```markdown
# DEC-YYYY-NNN: titulo

- Estado: propuesta | aceptada | reemplazada
- Owner:
- Fecha:
- Revisar antes de:

## Contexto

## Evidencia

## Opciones

## Decision

## Consecuencias y riesgos

## Metrica que confirmara o revertira
```

## Primeras decisiones requeridas

Antes del Hito 1 deben responderse, como minimo:

1. usuario/comprador primario
2. nivel de salida inicial L0 o L1
3. region/comunas piloto
4. quien valida catalogo y riego
5. precision minima de sitio
6. accion comercial final: visita, cotizacion o venta
7. politica de direccion/fotos/retencion
8. definicion de exito cuantitativa del piloto

Si estas respuestas no existen, ingenieria debe implementar estructuras reversibles y evitar automatizaciones costosas.
