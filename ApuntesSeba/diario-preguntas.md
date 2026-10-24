# Guía de preguntas para tu Diario de Reflexión Fase 2 (KAN-173)

Archivo a completar: `Fase 2/2.- Evidencias Individuales/Sebastian_Ramirez_2.1_APT122_DiarioReflexionFase2.docx` (hoy solo tiene las 6 preguntas, sin respuestas).

**Cómo usar esta guía:** el diario es una reflexión personal y debe sonar a ti. Aquí no hay respuestas redactadas: hay preguntas para ayudarte a recordar y datos objetivos del proyecto como apoyo. Responde en tus palabras, con ejemplos concretos (una fecha, una tarea, un problema). Una respuesta de 1 a 3 párrafos por pregunta suele bastar; la pauta no fija extensión.

La pauta dice que se responde "con tu grupo": conviene conversar las preguntas 5 y 6 con Samuel y Benjamín antes de escribirlas.

---

## Pregunta 1 — Carta Gantt: ¿cumpliste las actividades en los tiempos definidos? ¿Qué factores facilitaron o dificultaron?

Para pensar:
- Abre tu carta Gantt (no la tengo) y marca cada actividad tuya como cumplida, atrasada, ajustada o no iniciada. ¿Cuáles y por qué?
- ¿Qué te facilitó avanzar? (herramientas, claridad de la tarea, apoyo del equipo, decisiones ya tomadas)
- ¿Qué te frenó? (decisiones pendientes, dependencias de otras personas, problemas técnicos, tiempo)
- ¿Entregaste a tiempo lo que tenías comprometido en las actas? ¿Qué quedó para después?

Datos de apoyo (verificables):
- Tu rol fijo en todas las actas: backend/API, admin-site y registro de actas.
- Acta 7 (10 oct): te asigna KAN-166 (estructura del admin) y KAN-169 (PoC Fastify vs Express), plazo 17 oct. En el acta 8 la PoC seguía "en curso" y el acta 9 la replanteó para el 31 oct. En Jira, KAN-169 figura Finalizado el 23 oct.
- Acta 8 (17 oct): te suma Diseño 7 y 8 (planilla de casos de prueba y documentación de la metodología), plazo 23 oct. Hoy esas tareas están asignadas a Samuel y en revisión.
- Ningún commit de código anterior al 23 de octubre menciona un KAN. Los avances de código se concentran en el 23 y 24 de octubre.
- Quedó hecho entre el 23 y 24 oct (rama `dev-sebamax`): esquema de base de datos del primer corte y de proveedores, login del administrador, panel base con menú por permisos, catálogo (categorías, listado y ficha de producto con imágenes), proveedores (revisión de documentos, aprobar/rechazar/suspender), roles y permisos, registro de auditoría.

## Pregunta 2 — ¿Cómo has enfrentado y/o planeas enfrentar las dificultades?

Para pensar:
- Elige 2 o 3 dificultades reales y cuenta qué hiciste: ¿pediste ayuda?, ¿probaste algo?, ¿cambiaste el plan?
- ¿Qué aprendiste de cada una? ¿Qué harías distinto la próxima vez?
- ¿Qué dificultades siguen abiertas y cuál es tu plan para ellas?

Datos de apoyo:
- Decisiones técnicas o de negocio pendientes que afectaron el trabajo: Fastify vs Express (arrastrada desde el acta 4), motor de base de datos (el acta 4 dice PostgreSQL y el proyecto usa MySQL), comisión vs mensualidad, dónde guardar las imágenes, si el 2FA entra o no.
- Problemas técnicos de estas jornadas: contenedores Docker que no detectaban cambios hechos desde Windows, un cuelgue de Docker Desktop, y un bloqueo de CORS entre el panel (puerto 4300) y el backend.
- Cambio de responsables en Jira (KAN-146 pasó a Benjamín; KAN-176, 178, 186 y 187 a Samuel).
- Pendientes abiertos hoy: 2FA (KAN-112), lado proveedor de KAN-150, y las historias de órdenes, pagos, liquidaciones y analítica.

## Pregunta 3 — Hasta ahora, ¿cómo evalúas tu trabajo? ¿Qué destacas y qué podrías mejorar?

Para pensar:
- ¿De qué estás más satisfecho y por qué? (algo concreto que construiste o entendiste)
- ¿Qué haría falta para que lo evalúes mejor? (más pruebas, mejor comunicación, avanzar antes, documentar)
- ¿Qué parte del trabajo hiciste tú directamente y qué parte con apoyo de herramientas o de compañeros? Sé específico y honesto: tu docente evalúa tu aporte individual, y conviene que el diario sea coherente con lo que se ve en el repositorio.
- ¿Qué competencias del perfil de egreso sientes que desarrollaste?

Datos de apoyo:
- Las rúbricas valoran el aporte individual visible en el repositorio (15 puntos en la nota final) y la entrega en Git (15 puntos).
- Commits: SebaMax097 13 en total (12 de ellos el 23 y 24 oct). Importante: esos 12 todavía están **solo en tu máquina** hasta que los subas.
- Pruebas: la planilla de casos tenía 1 de 32 casos ejecutado; hoy hay 30 casos con resultado SÍ en el borrador, más 99 tests automáticos que pasan en los paquetes.

## Pregunta 4 — ¿Qué inquietudes te quedan? ¿Qué pregunta harías a tu docente o a tus pares?

Para pensar:
- ¿Qué no te quedó claro de la rúbrica, del alcance del MVP o de lo que se espera en la Evaluación 2?
- ¿Qué decisiones técnicas te gustaría validar con alguien con más experiencia? (por ejemplo: comisión vs mensualidad, simulación del split de pagos, manejo de documentos tributarios simulados)
- ¿Hay algo del trabajo en equipo que quisieras preguntar a Samuel y a Benjamín?

Dudas abiertas que ya detectamos (podrías usarlas como pregunta):
- ¿El diario es individual o grupal? El archivo es individual, pero la pauta dice que se responde con el grupo.
- ¿Debe entregarse el informe técnico completo (con abstract y reflexión en inglés) o solo completar las guías?
- ¿Se puede entregar la planilla de pruebas con casos "pendientes de ejecución", o deben estar aplicadas?
- No consta en las actas ninguna retroalimentación del docente. ¿Hubo alguna? Si la hubo, la rúbrica 2.5 pide usarla para justificar ajustes.

## Pregunta 5 — ¿Deben redistribuirse actividades entre miembros? ¿Hay nuevas actividades por asignar?

Para pensar (conviene conversarla con el equipo):
- ¿Qué tareas se acumularon en una persona y cuáles quedaron sin avanzar? ¿Qué se podría repartir mejor?
- ¿Hay tareas que dependen de otra persona para avanzar? (ejemplo conversado: las ofertas del proveedor dependen de lo que ya hiciste del catálogo)
- ¿Qué actividades nuevas aparecieron y no están en el plan?

Datos de apoyo:
- Reparto fijo en las actas: Samuel = app mobile, base de datos, infraestructura; Benjamín = ecommerce web y UX; Sebastián = backend/API, admin-site y registro de actas.
- Acta 9 (22 oct): el ecommerce web de Benjamín se posterga a la semana 13; en el acta 8 tenía 23 tareas "por hacer".
- Cambios de responsable ya hechos en Jira el 23 y 24 de octubre (ver pregunta 2).
- El acta 8 asigna las actas a Samuel, aunque tu rol incluye registrarlas.
- Nuevas actividades que aparecieron: el lado proveedor de KAN-150, el 2FA, y los entregables de documentación de la Evaluación 2.

## Pregunta 6 — APT grupal: ¿cómo evalúan el trabajo en grupo? ¿Aspectos positivos y a mejorar?

Para pensar (también conviene hablarla en equipo):
- ¿Cómo ha sido la comunicación? ¿Se cumplen los acuerdos de las actas? ¿Se reciben y se dan retroalimentaciones?
- ¿Se reparte equitativamente la carga? ¿Cómo se ve eso en Jira y en el repositorio?
- ¿Qué cambiarían para las próximas semanas? (reuniones, tablero, revisión de código, ramas, documentación)
- ¿Qué cosas funcionan bien y quieren mantener?

Datos de apoyo:
- Los tres asistieron a las 9 actas (todas "Presente"). Las firmas de conformidad están vacías en todas.
- Se trabaja con Kanban en Jira (Por hacer, En curso, En revisión, Finalizado) y reunión semanal los sábados.
- Distribución de commits en el repositorio: la mayor parte de los de código está en una sola persona hasta ahora; los demás aportes están en documentos, merges y la estructura del repo. Es un dato objetivo, no un juicio: conviene que el equipo lo conozca y decida qué hacer, porque las rúbricas piden evidencia clara de equidad y participación.

---

## Antes de entregar
- [ ] Respondí las 6 preguntas con ejemplos concretos y fechas.
- [ ] Revisé ortografía y lenguaje técnico (la rúbrica penaliza errores).
- [ ] Hablé las preguntas 5 y 6 con Samuel y Benjamín.
- [ ] Lo que digo coincide con lo que se ve en Jira y en el repositorio.
- [ ] Subí mis commits al repositorio (si quiero que cuenten como evidencia).
