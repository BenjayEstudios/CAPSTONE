# Material para las pruebas de usabilidad

**Fecha:** 2026-11-20 · **Épica:** KAN-88 · **Ticket:** KAN-165 (en curso)

## Qué cambió

Nueva carpeta `docs/qa/` con lo necesario para correr las pruebas de
usabilidad con usuarios piloto:

| Criterio | Estado |
|---|---|
| Guion de pruebas para cliente (web y mobile), proveedor y admin | ✅ [GUION-USABILIDAD.md](../qa/GUION-USABILIDAD.md). Incluye perfiles y cantidad de participantes, preparación del ambiente, cómo se conduce una sesión de 40 minutos y la hoja de observación. Trae las tareas de cada perfil con su criterio de éxito: 8 del cliente web, 4 del cliente mobile, 9 del proveedor y 5 del administrador. También define qué se mide |
| Formulario de retroalimentación | ✅ [FORMULARIO-RETROALIMENTACION.md](../qa/FORMULARIO-RETROALIMENTACION.md): perfil, escala SUS (10 ítems, con cómo calcular el puntaje), preguntas sobre la utilidad y la confianza en el pago, y preguntas abiertas. Listo para pasar a Google Forms |
| Informe de hallazgos con mejoras priorizadas en el backlog | ⏳ Hay [plantilla](../qa/PLANTILLA-INFORME-HALLAZGOS.md) (resultados por tarea, hallazgos con severidad 1 a 4, mejoras priorizadas con su ticket). Falta hacer las sesiones con personas reales y completarlo |

## Por qué así

- **Tareas escritas como situaciones** ("Necesitas aceite para la cocina…")
  y no como instrucciones de interfaz: si el guion nombra el botón, la prueba
  no mide si se encuentra.
- **SUS** porque es la escala estándar y comparable (68 = promedio de la
  industria). **Facilidad 1 a 7 por tarea** para ubicar dónde está el
  problema.
- **Pasarela simulada** en el ambiente de prueba (KAN-164): el pago no
  depende de Transbank ni de tarjetas de prueba.

## Archivos

- `docs/qa/README.md`, `GUION-USABILIDAD.md`, `FORMULARIO-RETROALIMENTACION.md`, `PLANTILLA-INFORME-HALLAZGOS.md`.
- `docs/README.md` (índice).
