# features

Features de negocio, cada una en su propia carpeta con sus rutas
(`<feature>.routes.ts`), componentes, servicios y tipos. Pensadas para
lazy loading vía `app.routes.ts`.

Previstas (según el dominio de Cotizapp — cliente/pyme y distribuidor
comparten esta misma app):

- `catalogo` — exploración y comparador de productos/distribuidores.
- `carro` — carrito multiproveedor.
- `checkout` — pago único (Webpay/MercadoPago sandbox) y detalle consolidado.
- `panel-distribuidor` — perfil, catálogo, precios por volumen, estadísticas.
- `admin` — aprobación de distribuidores, categorías, métricas globales.

Ninguna implementada todavía — este README documenta la convención para
quien empiece a construirlas.
