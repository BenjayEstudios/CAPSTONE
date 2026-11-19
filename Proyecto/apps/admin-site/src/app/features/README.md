# features

Features de administración, cada una en su propia carpeta con sus rutas
(`<feature>.routes.ts`), componentes, servicios y tipos. Pensadas para
lazy loading vía `app.routes.ts`.

Previstas (equipo interno Cotizapp, rol `administrador` únicamente):

- `usuarios` — gestión de usuarios y organizaciones, aprobación de distribuidores.
- `moderacion` — casos de moderación (`moderacion_caso`).
- `catalogo` — categorías y catálogo global.
- `auditoria` — consulta de `auditoria_log` y métricas (`evento_analitico`).

Ninguna implementada todavía — este README documenta la convención para
quien empiece a construirlas.
