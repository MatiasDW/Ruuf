# 12. Fuentes y notas de investigacion

Fecha de consulta: 14 de agosto de 2026.

Este documento registra las fuentes utilizadas para decisiones que pueden cambiar. No convierte automaticamente sus datos en reglas listas para produccion. Toda ingestion debe revisar licencia, cobertura, unidad, calidad, vigencia y condiciones de uso.

## Arquitectura y geometria

### Django / GeoDjango

- [GeoDjango installation](https://docs.djangoproject.com/en/6.1/ref/contrib/gis/install/): Django incluye GeoDjango y recomienda PostGIS como la base espacial open source mas madura y rica en funciones.
- [Django deployment checklist](https://docs.djangoproject.com/en/4.1/howto/deployment/checklist/): HTTPS, cookies, configuracion de produccion, logging y conexiones.
- [Django CSRF protection](https://docs.djangoproject.com/en/dev/howto/csrf/): middleware y token CSRF para requests inseguros.

La version concreta de Django/PostgreSQL/PostGIS debe fijarse al comenzar implementacion y seguir una matriz compatible y soportada. Los enlaces pueden apuntar a documentacion mas nueva que la version elegida.

### PostGIS

- [PostGIS official manual](https://postgis.net/documentation/manual/): versiones publicadas y documentacion espacial.
- [PostGIS spatial queries](https://www.postgis.net/docs/manual-dev/en/using_postgis_query.html): predicados espaciales e importancia de funciones que usan indices.
- [PostGIS spatial indexes](https://www.postgis.net/docs/manual-3.3/using_postgis_dbmanagement.html): GiST, SP-GiST y BRIN para datos espaciales.

PostGIS se recomienda por el modelo de geometria y consultas espaciales, no porque cada movimiento de drag deba consultar la base.

### React y tipos

- [React: Using TypeScript](https://react.dev/learn/typescript): integracion oficial de TypeScript con componentes y hooks.

## Optimizacion

- [Google OR-Tools: Constraint Optimization](https://developers.google.com/optimization/cp/): modelar soluciones factibles mediante restricciones.
- [Google OR-Tools: CP-SAT](https://developers.google.com/optimization/cp/cp_solver): CP-SAT opera con enteros y devuelve estados `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`, `MODEL_INVALID` o `UNKNOWN`.

Esto respalda un solver discreto para candidatos. No demuestra que CP-SAT sea automaticamente mejor para composicion paisajistica; debe compararse con la heuristica sobre el corpus real.

## Riego y clima

- [INIA: Riego y evapotranspiracion](https://sitios.inia.cl/agrometeorologia/boletin-415/capitulo-6-riego-y-evapotranspiracion/): relacion `ETa = Kc x ETo` y necesidad de ajustar coeficientes a condiciones locales.
- [Red Agrometeorologica INIA](https://agrometeorologia.cl/index.php/evapotranspiracion/): consulta de ETo y estaciones de INIA, CEAZA, DMC y otras instituciones.
- [FAO 56: Crop coefficient approach](https://www.fao.org/4/X0490E/x0490e0b.htm): calculo de evapotranspiracion mediante `ETc = Kc x ETo`.
- [Direccion Meteorologica de Chile: Servicios Climaticos](https://climatologia.meteochile.gob.cl/): datos historicos, estaciones y web services; el portal pide citar a DMC como fuente.

El coeficiente agricola Kc no debe copiarse sin criterio a paisajismo ornamental. La implementacion necesita coeficientes vegetales/densidad/microclima revisados y rangos de incertidumbre.

## Biodiversidad y especies

- [SIMBIO/SBAP: busqueda de especies](https://simbio.mma.gob.cl/Especies): taxonomia, origen respecto de Chile, conservacion y descargas. El portal informa que desde febrero de 2026 SBAP es responsable de los datos oficiales de biodiversidad y SIMBIO mantiene interoperabilidad durante la transicion.
- [Ministerio del Medio Ambiente: Especies Exoticas Invasoras](https://especies-exoticas.mma.gob.cl/): definiciones, riesgos y recomendacion de preferir plantas nativas.
- [MMA: preguntas frecuentes sobre invasoras](https://especies-exoticas.mma.gob.cl/preguntas-frecuentes/): advierte evitar plantas potencialmente invasoras para jardineria, especialmente en ambientes rurales.

Estas fuentes sirven para identidad, origen, conservacion y alertas. Distancias maduras, disponibilidad comercial y reglas de jardin requieren fuentes horticulturales adicionales y revision profesional.

## Tarifas de agua en Chile

- [Ley Chile, ejemplo de decreto tarifario](https://www.leychile.cl/navegar?idNorma=1098980): muestra cargo fijo mensual, cargo variable por `m3`, periodos punta/no punta y reglas de sobreconsumo segun el decreto aplicable.
- [SISS: Servicios Sanitarios Rurales](https://ssr.siss.gob.cl/): portal oficial para el ambito rural.
- [ChileAtiende: institucion SISS](https://www.chileatiende.gob.cl/instituciones/superintendencia-de-servicios-sanitarios): acceso a tramites e informacion institucional.
- [Portal de Datos Abiertos: organizacion SISS](https://datos.gob.cl/organization/superintendencia_de_servicios_sanitarios): conjuntos publicados; su cobertura/actualidad debe verificarse antes de depender de ellos.

No se encontro durante esta auditoria una unica API publica y estable que entregue automaticamente toda tarifa urbana vigente por coordenada, componente y periodo. Por eso el plan propone adaptadores por fuente, staging y aprobacion humana, no una dependencia directa no verificada.

## Privacidad y seguridad

- [Biblioteca del Congreso Nacional: Ley 21.719](https://www.bcn.cl/leychile/Navegar/imprimir?idNorma=1209272): regula proteccion y tratamiento de datos personales, crea la Agencia y señala vigencia desde el 1 de diciembre de 2026.
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): recomienda algoritmos adaptativos y Argon2id para nuevas aplicaciones.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): manejo de sesiones y advertencia contra guardar tokens/credenciales en Web Storage.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/): base para requisitos y verificacion de seguridad web.
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html): gestion de claves y cifrado proporcional al threat model.
- [GDPR, texto oficial en EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679): principios del articulo 5 y privacidad por diseño/defecto del articulo 25.

## Asistente AI

- [OpenAI API quickstart](https://platform.openai.com/docs/quickstart): Responses API, tools y Agents SDK como opciones para orquestacion backend.
- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model): recomienda Responses API para razonamiento, tool calling y flujos multi-turn, ademas de limites de autonomia y evaluacion de tools.

Estas referencias no obligan a usar un modelo concreto. La aplicacion debe mantener un gateway y contratos de tools independientes del proveedor, con evaluaciones propias de calidad, privacidad, latencia y costo.

La interpretacion legal y las obligaciones concretas dependen del rol de la empresa, finalidades, contratos y operaciones. Se necesita revision juridica antes del lanzamiento.

## Fuentes aun necesarias

Antes de afirmar cobertura profesional se deben obtener y validar:

- manuales/reglas internas de los profesionales que ejecutaran el piloto
- fuentes de tamano maduro y distancias por cultivar
- datos locales de toxicidad, alergenos, raices e infraestructura
- politicas municipales/condominios relevantes
- areas de concesion y documentos tarifarios vigentes por proveedor piloto
- disponibilidad/precio desde viveros y proveedores reales
- curvas o rangos de demanda para ornamentales bajo condiciones chilenas
- rendimientos de mano de obra, merma y costos historicos de la empresa
- requisitos tecnicos y normativos de riego que el negocio ofrecera como L2

## Politica para incorporar una fuente

Una fuente solo alimenta decisiones de usuario despues de responder:

1. ¿Quien la publica y con que autoridad?
2. ¿Cual es su licencia o condicion de uso?
3. ¿Que region, periodo y especies cubre?
4. ¿Cual es la unidad y definicion exacta?
5. ¿Como se actualiza o retira?
6. ¿Que transformacion realiza el sistema?
7. ¿Quien revisa y con que confianza?
8. ¿Que proyectos se ven afectados si cambia?

La URL sola no es procedencia suficiente; guardar tambien fecha, checksum/version y transformacion.
