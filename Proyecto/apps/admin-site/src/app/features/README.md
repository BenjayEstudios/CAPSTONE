# features

Features del panel de administración, cada una en su propia carpeta con sus
rutas (`<feature>.routes.ts`), componentes, servicios y tipos, cargadas con
lazy loading desde `app.routes.ts`. Las ve el equipo interno de Cotizapp; qué
secciones aparecen y qué se puede hacer lo decide la matriz de permisos del
rol (`permisoGuard` y el menú del shell), no el nombre del rol.

| Carpeta | Qué hace | Ticket |
|---|---|---|
| `login` | Ingreso con segundo paso de 2FA | KAN-112 |
| `shell` | Layout: menú lateral por permisos, cabecera, cierre de sesión | KAN-167 |
| `dashboard` | KPIs, monto transado por semana, proveedores y salud del catálogo | KAN-113 |
| `moderacion` | Cola de casos de moderación | KAN-114 |
| `proveedores` | Revisión de documentos, aprobación y suspensión | KAN-115 |
| `catalogo` | Listado maestro, ficha de producto e importación masiva | KAN-116, KAN-117 |
| `categorias` | Árbol de categorías de dos niveles | KAN-118 |
| `ordenes` | Órdenes de la plataforma y sus envíos | KAN-119 |
| `reembolsos` | Reembolso total o parcial con nota de crédito | KAN-120 |
| `usuarios` | Alta, edición y suspensión de usuarios | KAN-121 |
| `roles` | Matriz rol × permiso | KAN-122 |
| `liquidaciones` | Cortes semanales a proveedores | KAN-123 |
| `auditoria` | Registro de auditoría con diff antes/después | KAN-124 |
| `en-construccion` | Pantalla de relleno para secciones sin implementar | — |

Para agregar una feature nueva: carpeta con su `<feature>.routes.ts`, ruta
lazy en `app.routes.ts` con el `permisoGuard` que corresponda, y entrada en el
menú del shell.
