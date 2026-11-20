# Documentación — Cotizapp

Toda la documentación del proyecto, por tema. Cada carpeta tiene su propio
índice.

| Carpeta | Qué contiene |
|---|---|
| [arquitectura/](arquitectura/README.md) | El patrón general: capas, reglas de dependencia, cada app, el modelo de datos y la infraestructura. |
| [epicas/](epicas/README.md) | Un archivo por épica de Jira, con su alcance, lo cerrado y lo pendiente por ticket. Incluye la tabla de estado general. |
| [decisiones/](decisiones/README.md) | Decisiones que cruzan varias épicas, abiertas y cerradas, con su motivo. |
| [diseno/](diseno/IDENTIDAD-VISUAL.md) | Identidad visual: paleta, de dónde sale y dónde está implementada. |
| [cambios/](cambios/README.md) | Bitácora cronológica: qué cambió, por qué y qué toca. |
| [desarrollo/](desarrollo/README.md) | Cuentas de prueba, operación de la base y lo que hace falta para trabajar en el proyecto. |
| [jira/](jira/README.md) | Export del backlog de Jira (fuente de las épicas). |

## Dónde escribir cada cosa

- **El patrón** (cómo se organiza el código, qué depende de qué) →
  `arquitectura/`.
- **La evolución** (qué se hizo y cuándo) → `cambios/`.
- **El plan** (qué falta y en qué orden) → `epicas/`.
- **Un "ya lo decidimos"** → `decisiones/`.
- **Algo que hace falta para trabajar y no está en el código** (cuentas de
  prueba, tareas periódicas de la base) → `desarrollo/`.

No se mezclan: la arquitectura describe cómo son las cosas hoy, los cambios
describen cómo llegaron a serlo.

Cómo levantar el entorno, agregar una feature o proteger una ruta está en el
[README del proyecto](../README.md); el despliegue y el CI, en
[infra/README.md](../infra/README.md). Acá no se duplica.

La convención completa de nombres y estructura está en
`.claude/rules/documentation.md` (raíz del repo).
