# KAN-86 — Página administradora

**Estado:** ⏳ Pendiente · **Responsable:** Sebastián Ramírez ·
**App:** `apps/admin-site`

Panel interno del equipo Cotizapp: estado de la plataforma, moderación,
aprobación de proveedores, catálogo maestro, órdenes, reembolsos, usuarios y
roles, liquidaciones y auditoría.

## Lo que hay hoy

- Scaffold Angular 18 (puerto 4300) con la misma estructura que
  `ecommerce` y la vista de status.
- Lint y tests mínimos, aún sin commitear (igual que en ecommerce).
- **No** se sirve todavía en producción (KAN-168).

## Tickets

| Ticket | Historia | Estado |
|---|---|---|
| KAN-166 | Estructura base de la app | 🔄 Scaffold listo; faltan guards, interceptor y sesión |
| KAN-167 | Shell y navegación del panel | ⏳ |
| KAN-112 | Acceso al panel de administración | ⏳ |
| KAN-113 | Dashboard estado de la plataforma | ⏳ |
| KAN-114 | Cola de moderación | ⏳ |
| KAN-115 | Aprobación y suspensión de proveedores | ⏳ |
| KAN-116 | Catálogo maestro: listado | ⏳ |
| KAN-117 | Crear y editar ficha de producto | ⏳ |
| KAN-118 | Gestión de categorías | ⏳ (`GET/POST /categorias` existen) |
| KAN-119 | Órdenes de la plataforma | ⏳ |
| KAN-120 | Reembolsos | ⏳ |
| KAN-121 | Gestión de usuarios | ⏳ |
| KAN-122 | Roles y permisos (matriz) | ⏳ |
| KAN-123 | Liquidaciones a proveedores | ⏳ |
| KAN-124 | Registro de auditoría | ⏳ |

## Dependencias

Login (KAN-144) y usuarios/roles (KAN-151) de la API. Los roles internos del
seed son `admin_general`, `editor_catalogo` y `soporte`.

## Referencias

Mockup `Mockups/CompraMejor Administrador.html`.
