# Requisitos Fase 2 por tarea Jira (extraido de Fase 2/, solo lectura)

Fuentes: guias 2.4 y 2.6 (docx), rubricas 2.5 y 2.7 (pdf), diario 2.1 (docx), planilla 7 y registro de cambios (xlsx). Analisis: 2026-10-24.

**Hallazgo transversal:** las guias 2.4 y 2.6 YA traen texto redactado en todas sus secciones (resumen, plan de trabajo y Secc. 3 en 2.4; Secc. 1-6 en 2.6). El diario 2.1 esta VACIO (solo consignas). Los marcadores 🔴 existen solo en nombres de archivo/carpeta, no dentro de celdas.

## Niveles de rubrica (ambas)
Completamente logrado 100% | Logrado 60% | Logro incipiente 30% | No logrado 0%. Puntaje de cada indicador = ponderacion x %.

## Formato exigido a los informes (rubricas 2.5 y 2.7)
- Informe tecnico: portada, indice, abstract (ingles y espanol), desarrollo de ingenieria, conclusiones individuales (solo ingles), reflexion (solo ingles).
- Arial/Verdana/Calibri, tamano 11 o 12, interlineado 1,0 o 1,5, numero de pagina, bibliografia y anexo de evidencia si corresponde.
- Ortografia y lenguaje tecnico preciso; evidencias en Git con estructura y nombres pedidos; aporte individual visible en el repo.
- 2.5 (avance): 20% de la nota, semana 9, grupal 2-3 integrantes. 2.7 (final): 30%, semana 15, presentacion de 20 min ante "comision", calificacion individual.

---
## KAN-176 - Guia 2.4 Desarrollo, Secc. 3 "Ajustes a partir del monitoreo"
**(a) Consigna:** "Profundiza en las observaciones de tu plan de trabajo. Analiza las actividades planificadas y senala que aspectos facilitaron u obstaculizaron la ejecucion. Plantea como abordaste y/o abordaras los obstaculos. Senala los ajustes que realizaste al plan." Tres campos fijos, sin extension indicada:
1. Factores que han facilitado y/o dificultado el desarrollo del plan.
2. Actividades ajustadas o eliminadas.
3. Actividades no iniciadas o retrasadas (y como se avanzara).
Estado actual: los 3 campos tienen texto. Estados validos del plan: En curso / Con retraso / No iniciado / Completado / Ajustada.

**(b) Rubrica 2.5:**
| IE | Pond. | Maximo exige |
|---|---|---|
| 1. Propone ajustes considerando dificultades, facilitadores y retroalimentacion | 10 | Ajustes realizados o por realizar, JUSTIFICADOS con dificultades, facilitadores y retroalimentacion del docente (60%: justifica con solo algunos; 30%: ajustes sin justificar; 0%: sin ajustes, mantiene plan) |
| 2. Metodologia que logra objetivos | 10 | Metodologia segun estandares de la disciplina y objetivos de avance alcanzados |
| 3. Evidencias de avance (documentacion, programacion, datos) | 25 | Evidencias acordes a lo planificado y a estandares de la industria |
Resto 2.5: IE4 lenguaje tecnico 5; IE5 redaccion/ortografia 5 (0 errores); IE6 entrega en Git 20; IE7 aporte individual en repo 15; IE8 trabajo en equipo 10.

**(c)** No aplica xlsx. Verificar coherencia Secc. 3 con la tabla del plan (Secc. 2) y con el xlsx de cambios (ver KAN-187).

**(d) Fuentes posibles:** tablero Jira (estados, reasignaciones), actas 001-009 (29 ago a 22 oct), git log, registro de cambios SC-01..06, retroalimentacion docente sobre diagramas (citada en el plan).

**Posibles huecos:** el texto de Secc. 3 no cita explicitamente la retroalimentacion del docente (el IE1 la pide). Estados "Con retraso"/"No iniciado" deben coincidir con el estado real del repo al 24 oct.

---
## KAN-178 - Guia 2.6 Informe Final, Secc. 3 Metodologia y Secc. 4 Desarrollo
**(a) Consigna (guia):** "describas los aspectos mas relevantes... fundamentes las decisiones que tuviste que tomar". Estructura: 1 Relevancia, 2 Objetivos, 3 Metodologia, 4 Desarrollo, 5 Evidencias, 6 Intereses y proyecciones. La guia no fija extension ni subtitulos. Contenido actual:
- Secc. 3: Kanban en Jira (Por hacer/En curso/En revision/Finalizado), 4 epicas + epica de documentacion, 4 fases, revisiones semanales con actas, CI/CD, justificacion de pertinencia.
- Secc. 4: 4 etapas, facilitadores, dificultades, ajustes (un solo parrafo).

**(b) Rubrica 2.7:**
| IE | Pond. | Maximo exige |
|---|---|---|
| 1. Implementa metodologia que logra objetivos | 10 | Describe la metodologia segun estandares de la disciplina, alcanzando TODOS los objetivos propuestos (60%: cumple parcialmente los objetivos; 30%: cumple parcialmente estandares y objetivos; 0%: ninguno) |
| 2. Evidencias de cumplimiento (documentacion, programacion, datos) | 20 | Evidencias que dan cuenta del cumplimiento y cumplen estandares de industria |
| 7. Documentacion y evidencias en Git | 15 | Todas las evidencias de avance guardadas en Git, estructura y nombres pedidos |
| 9. Aporte de cada integrante en repo | 15 | Evidencia clara de equidad y participacion |
| 5 y 6. Lenguaje tecnico / redaccion y ortografia | 5 + 5 | Lenguaje tecnico en todos los entregables; 0 errores (1-5 errores = 60%) |
Otros IE: 3 intereses profesionales 5; 4 competencias del perfil de egreso 5; 8 exposicion 10; 10 trabajo en equipo 10 (3, 8 y 10 son individuales).

**(c)** No aplica xlsx.

**(d) Fuentes posibles:** tablero Jira (epicas KAN, flujo de estados), actas 001-009, workflows de GitHub Actions/Docker, git log y PRs, tests, diseno (arquitectura, dbDiagram), registro de cambios.

**Posibles huecos:** en 2.4 los objetivos de carrito/pasarela, seguridad/respaldos y usabilidad estaban "No iniciado"; contrastar con el repo actual antes de afirmar que se alcanzaron todos los objetivos (IE1).

---
## KAN-173 - Diario de reflexion (2.1, individual de Sebastian Ramirez)
**(a) Consigna:** archivo individual, pero la pauta dice "debe ser respondida con tu grupo"; se carga en la seccion de reflexion de la Fase 2 para retroalimentacion docente. Seis preguntas, todas SIN responder, sin extension indicada:
1. Mira tu carta Gantt: ¿cumpliste todas las actividades en los tiempos definidos? ¿Que factores facilitaron o dificultaron?
2. ¿Como has enfrentado y/o planeas enfrentar las dificultades?
3. Hasta el momento: ¿como evaluas tu trabajo? ¿Que destacas y que podrias mejorar?
4. ¿Que inquietudes te quedan? ¿Que pregunta harias a tu docente o pares?
5. ¿Deben redistribuirse actividades entre miembros? ¿Hay nuevas actividades por asignar? (redactada en plural)
6. APT grupal: ¿como evaluan el trabajo en grupo? ¿Aspectos positivos y a mejorar?

**(b) Rubrica:** ninguno de los PDFs entregados tiene rubrica propia del diario. Se relaciona con 2.5 IE1 (ajustes) e IE8 / 2.7 IE10 (trabajo en equipo), pero no se puntua por separado segun los archivos.

**(c)** No aplica xlsx.

**(d) Fuentes posibles:** carta Gantt / plan de trabajo (tabla de 2.4), tablero Jira, git log propio, actas (asistencia/acuerdos), Secc. 3 de 2.4 (para coherencia). Autoevaluacion e inquietudes las debe aportar Sebastian.

---
## KAN-186 - Planilla de casos de prueba (`7.Planilla Casos de Prueba.xlsx 🔴.xlsx`)
**(a) Consigna:** estados OK = cumple, NC = no cumple en forma optima, NA = no aplica, marcados por hito.

**(b) Rubrica:** respalda "Genera evidencias... documentacion/programacion" (2.5 IE3 = 25 pts; 2.7 IE2 = 20 pts) y los indicadores de calidad 1.1/1.2 (disenar y aplicar pruebas de validacion) y 1.3 (mejoras segun resultados). Maximo: pruebas disenadas Y aplicadas, con resultados.

**(c) Hojas y huecos:**
| Hoja | Estructura | Estado / huecos |
|---|---|---|
| Pruebas Estandar | A=ID, B=hito, D=Estado, F=observacion; secciones 1 Interfaz (E-1.1..1.16), 2 Validacion datos (E-2.1..2.17), 3 Funcionales (E-3.1..3.15), 4 Informes (E-4.1..4.3), 5 Impresiones (E-5.1..5.5), 6 Observaciones | 56 hitos; solo 9 con estado (todos NA: E-1.7, 1.10, 1.11, 1.12, 5.1-5.5). 47 SIN estado en col. D (E-1.1..1.6, 1.8, 1.9, 1.13..1.16; todo 2.x; todo 3.x; 4.1..4.3). NA sin observacion: E-5.2 a E-5.5. Cabecera "Estado" solo en D6. E-6.3..6.5 vacios (A75:A77). E-6.1 dice que los sin estado quedan pendientes (ciclo 1, 23/10/2026) |
| Casos de Prueba | Cabecera: Cotizapp, modulos, jefe Samuel Alarcon, analistas Benjamin Gonzalez y Sebastian Ramirez, ciclo 1.0, 23/10/2026. Tabla filas 12-13: ID, MODULO, DESCRIPCION, PROCEDIMIENTO, DATOS, RESULTADO ESPERADO, RESULTADO OBTENIDO (G=SI, H=NO, I=N/A, J=Descripcion, K=Observacion) | 32 casos CP 0001-0032. Solo CP 0032 ejecutado (G45=X, CI en GitHub Actions). CP 0001-0031 (filas 14-44): G/H/I y J vacios, K="Pendiente de ejecucion (ciclo 1)". Sin columna de responsable, fecha de ejecucion ni evidencia |
| Totales | Resumen | Estandar: OK 0, NC 0, NA 9. Casos: total 32, OK 1, NC 0, NA 0, sin revisar 31. Actualizar al ejecutar (no verificado si son formulas; A1 contiene "<") |
Cobertura por modulo: Registro 3, Login 4 (incl. 2FA), Catalogo 4, Comparador 2, Carro 4, Checkout 2, Pagos 2, Ordenes 1, Proveedores 2, Ofertas 2, Admin 4, App mobile 1, Infra 1. Sin casos para: ficha de producto con galeria de imagenes, revision de documentos y suspension de proveedor, permisos por rol (solo CP 0030).

**(d) Fuentes posibles:** ejecucion en el entorno de pruebas, suites de tests del backend (Jest) y resultados de CI, coleccion Postman, tablero Jira, plan de pruebas (carpeta 6), requerimientos (xlsx 1).

---
## KAN-187 - Documentacion de la metodologia (carpeta `8.Documentación... 🔴/`)
**(a) Consigna:** tres entregables: (1) `Registros de cambios e incidencias.xlsx`, (2) `Listado de tareas (Obtener desde JIRA).docx`, (3) `Tablero Kanban (Obtener desde JIRA).docx`. Los dos docx piden extraer desde Jira; su contenido no se leyo (fuera de la lista).

**(b) Rubrica:** respalda 2.5 IE2 (metodologia, 10 pts) y 2.7 IE1 (10 pts) mas los IE de evidencias; maximo = metodologia Kanban/CI-CD documentada con artefactos reales coherentes con los objetivos.

**(c) Registros de cambios e incidencias.xlsx**, hoja unica `Hoja1` ("Matriz Control de Cambio"). Columnas: ID, Solicitante, Fecha solicitud, Tipo (SC/C), Urgencia (Critico/Urgente/Necesario), Importancia, Descripcion, Requerimiento RF, Caso de Uso CU, Fase, Impacto, Aprobacion.
- Filas con datos: SC-01..SC-06 (fechas 7 sep, 14 sep, 14 sep, 28 sep, 28 sep, 12 oct de 2026), todas "Aceptado", sin celdas vacias.
- Huecos: (i) el nombre dice "cambios e incidencias" pero NO hay hoja ni columnas de incidencias; (ii) no hay columnas de responsable, estado de implementacion ni referencia KAN; (iii) ajustes que 2.4 menciona y no figuran: reasignacion de BD y app mobile a Samuel, endpoints de ofertas/carrito/pagos a Sebastian, hardening/monitoreo/logs; (iv) incoherencia: SC-06 asigna API de ofertas KAN-146 a Benjamin, 2.4 Secc. 3 asigna "usuarios, roles, ofertas y carrito" a Sebastian; (v) ningun registro posterior al 12 oct (hay actas hasta el 22 oct).

**(d) Fuentes posibles:** tablero y listado de tareas en Jira (exportar), actas 001-009, git log (KAN-xxx en commits), requerimientos RF (xlsx 1), casos de uso.

---
## Dudas que no se deducen de los archivos
1. ¿El diario 2.1 es individual o grupal? Archivo individual, pauta dice "con tu grupo"; no hay rubrica del diario.
2. Las guias 2.4/2.6 ya traen texto completo: ¿es borrador valido a ajustar o hay que rehacerlo? No consta quien lo redacto.
3. ¿Que significa 🔴 en los nombres (pendiente, rechazado, por revisar)? En las celdas no hay marcas.
4. ¿Se debe producir el informe tecnico completo (portada, indice, abstract ES/EN, conclusiones y reflexion en ingles) o solo completar las guias docx? Las rubricas exigen el formato; las guias no.
5. ¿Puede entregarse la planilla de casos "Pendiente de ejecucion" o debe tener resultados? Las rubricas piden pruebas aplicadas (indicador 1.2).
6. No se leyeron actas, docx de listado/tablero Jira, plan de pruebas ni requerimientos (fuera de la lista).
