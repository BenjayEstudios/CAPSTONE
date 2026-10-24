# Plan de trabajo — jornada de 4 horas

Criterio: primero planificar y documentar (lo independiente y lo que se evalúa), luego programar de la base hacia arriba (esquema → API → pantallas). Las estimaciones son aproximadas; cada bloque tiene un tope de tiempo para no quedarse pegado.

Leyenda MoSCoW: **M** = Must (se entrega hoy), **S** = Should (si sobra tiempo), **C** = Could / **W** = Won't hoy (backlog, queda priorizado).

## Huecos detectados en el backlog (hay que cubrirlos o las historias se bloquean)

| # | Hueco | Quién lo necesita | Propuesta |
|---|---|---|---|
| G1 | Solo `categoria` está traducida a Drizzle. Faltan las demás tablas de `DataBase/dbDiagram.sql`. | Todas las historias `[API]` | Tarea nueva: esquema Drizzle (primero las tablas del primer corte: `organizacion`, `usuario`, `rol`, `producto`, `oferta`, `oferta_precio_historial`, `moderacion_caso`, `auditoria_log`). |
| G2 | No hay endpoint de **login** (emitir JWT) ni 2FA. `requireAuth` solo verifica tokens. | KAN-112, y toda ruta protegida | Tarea nueva: API de autenticación (login, 2FA). Puede ir dentro de KAN-151 o separada. |
| G3 | No hay API de **productos / catálogo maestro**. | KAN-116, KAN-117 | Tarea nueva: API productos (listar, crear, editar, imágenes). |
| G4 | Categorías solo tiene listar y crear. | KAN-118 (editar, ordenar, ocultar) | Ampliar el módulo `categorias` (editar, ocultar, ordenar). |
| G5 | No hay API de métricas del dashboard. | KAN-113 | Se resuelve con KAN-154 y KAN-149; queda para después. |

## Mapa de dependencias

```
Fase 0  Planificación y docs (sin dependencias)
  KAN-169 ──────────────────────────────┐ (decisión de framework: todo el backend depende de ella)
  KAN-173, 176, 178, 186, 187 (docs; independientes entre sí)

Fase 1  Base técnica
  G1 esquema Drizzle ──┬─▶ G2 login ──▶ KAN-112 acceso admin ─▶ KAN-167 shell
                       │
  KAN-166 estructura admin-site ────────────▶ KAN-167 shell
                       │
                       ├─▶ G4 categorías ──▶ KAN-118
                       └─▶ G3 productos ───▶ KAN-116 ─▶ KAN-117

Fase 2  Núcleo transaccional (después de la Fase 1)
  KAN-150 proveedores ─▶ (KAN-146 ofertas: asignada a Benjamín González, fuera de este plan) ─▶ KAN-147 carro/orden ─▶ KAN-148 pagos ─▶ KAN-149 estados de envío
  KAN-149 ─▶ KAN-152 liquidaciones ─▶ KAN-123 (pantalla)
  KAN-147/149 ─▶ KAN-153 DTE ─▶ KAN-120 reembolsos
  KAN-149 ─▶ KAN-119 órdenes (pantalla)

Fase 3  Transversales y administración
  KAN-155 auditoría/moderación ─▶ KAN-114 cola, KAN-124 auditoría, KAN-115 aprobación
  KAN-156 correos ─▶ KAN-151 usuarios/roles ─▶ KAN-121 usuarios, KAN-122 matriz
  KAN-154 eventos ─▶ KAN-113 dashboard
```

## Plan de la jornada (4 h)

### Bloque 0 — Planificación (≈ 25 min) · todo **M**

| Orden | Tarea | Por qué primero | Tiempo |
|---|---|---|---|
| 0.1 | **KAN-169** Decidir Fastify vs Express | Es una decisión que bloquea todo el backend. El código ya usa Fastify y hay una sola ruta implementada, así que el costo de migrar crece con cada ruta. Recomendación: quedarse en Fastify y documentar el onboarding. | 10 min |
| 0.2 | Crear en Jira las tareas G1 a G4 y ordenar el tablero | Sin ellas, las historias admin no se pueden terminar. | 15 min |

### Bloque 1 — Documentación (≈ 65 min) · todo **M**

Son entregables de la Evaluación 2, prioridad Highest, y no dependen del código. Se pueden hacer en sesiones paralelas.

| Orden | Tarea | Notas | Tiempo |
|---|---|---|---|
| 1.1 | **KAN-176** 2.4 Desarrollo, sección 3 (ajustes por monitoreo) | Se apoya en el estado real del tablero y los retrasos. | 15 min |
| 1.2 | **KAN-178** 2.6 Informe final, secciones 3 y 4 | La sección 3 (metodología) se escribe ahora; la sección 4 (desarrollo) se actualiza al final de la jornada. | 20 min |
| 1.3 | **KAN-187** 8. Documentación de la metodología | Exportar el listado de tareas y el tablero desde Jira. Mejor al final del bloque, con el tablero ya ordenado. | 10 min |
| 1.4 | **KAN-186** 7. Planilla de casos de prueba | Salen de los criterios de aceptación de las historias; sirven además como guía de la programación. | 10 min |
| 1.5 | **KAN-173** Diario de reflexión Fase 2 | Texto personal; se puede dejar para el cierre para incluir lo vivido en la jornada. | 10 min |

**Aviso:** los archivos de estas tareas están en Drive (Fase 2). No tengo acceso a Drive; hay que descargarlos a una carpeta del equipo o autenticar el conector.

### Bloque 2 — Base técnica (≈ 45 min) · **M**

| Orden | Tarea | Depende de | Tiempo |
|---|---|---|---|
| 2.1 | **G1** Esquema Drizzle del primer corte + migración | KAN-169 | 20 min |
| 2.2 | **KAN-166** Estructura base de admin-site | nada (puede ir en paralelo con 2.1) | 10 min |
| 2.3 | **G2** Login + JWT (2FA solo si alcanza el tiempo) | 2.1 | 15 min |

### Bloque 3 — Corte vertical del catálogo (≈ 75 min) · **M**

Un corte vertical (API + pantalla) deja algo demostrable en cada paso.

| Orden | Tarea | Depende de | Tiempo |
|---|---|---|---|
| 3.1 | **KAN-112** Acceso al panel de administración | 2.2, 2.3 | 15 min |
| 3.2 | **KAN-167** Shell y navegación | 3.1 | 10 min |
| 3.3 | **G4 + KAN-118** Categorías (API + pantalla) | 3.2 | 15 min |
| 3.4 | **G3** API de productos | 2.1 | 15 min |
| 3.5 | **KAN-116** Catálogo maestro: listado | 3.2, 3.4 | 10 min |
| 3.6 | **KAN-117** Crear y editar ficha de producto | 3.5 | 15 min |

### Bloque 4 — Ofertas (≈ 30 min) · **S**

| Orden | Tarea | Depende de | Tiempo |
|---|---|---|---|
| 4.1 | **KAN-150** Proveedores (perfil y aprobación; cobertura y documentos si alcanza) | 2.1, 2.3 | 15 min |

### Cierre (≈ 10 min)

Actualizar la sección 4 de KAN-178, el diario KAN-173, marcar tareas en `tareas-pendientes.md` y mover el tablero.

**Total estimado: ≈ 3 h 50 min.** No hay holgura: si un bloque se pasa de tiempo, se recorta el Bloque 4.

## Backlog priorizado para después de hoy

| Prioridad | Tarea | Razón (PM) |
|---|---|---|
| 1 | KAN-147 Carro y orden con split | Es el corazón del modelo de negocio (compra multiproveedor). |
| 2 | KAN-148 Pasarela de pago | Es el mayor riesgo técnico reconocido en la Fase 1. Conviene atacarlo pronto. |
| 3 | KAN-149 Órdenes y estados de envío | Cierra el flujo de compra; alimenta liquidaciones y dashboard. |
| 4 | KAN-155 Auditoría y moderación automáticas | Transversal; desbloquea KAN-114, KAN-115 y KAN-124. |
| 5 | KAN-115 Aprobación de proveedores, KAN-114 Cola de moderación | Highest en Jira; dependen de KAN-150 y KAN-155. |
| 6 | KAN-152 Liquidaciones, luego KAN-123 | Dan sentido a la comisión del modelo de negocio. |
| 7 | KAN-151 Usuarios y roles, KAN-156 Correos, luego KAN-121 y KAN-122 | Administración de accesos. |
| 8 | KAN-153 DTE simulado, luego KAN-120 Reembolsos | Medium; el SII real está fuera del MVP. |
| 9 | KAN-154 Eventos, luego KAN-113 Dashboard | Valor analítico; no bloquea el flujo de compra. |
| 10 | KAN-119 Órdenes (admin), KAN-124 Auditoría (pantalla) | Consulta; dependen de lo anterior. |

## Riesgos y decisiones abiertas

- Si el nombre del producto o el modelo de ingresos cambian, afectan solo textos y el porcentaje de comisión, no la estructura técnica.
- El 2FA completo (KAN-112) puede salirse de la jornada; se recomienda entregar login con roles y dejar el segundo factor como mejora.
- Las pantallas de admin no se pueden probar de verdad hasta que exista G1 y G2; por eso el orden es esquema, login y pantalla.
