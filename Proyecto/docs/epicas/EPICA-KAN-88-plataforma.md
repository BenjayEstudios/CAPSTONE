# KAN-88 — Plataforma (API, BD, infraestructura, pagos, QA)

**Estado:** 🔄 En curso

Lo transversal que usan los tres sistemas: API REST Fastify
(`apps/backend`), modelo de datos MySQL/Drizzle, infraestructura en Digital
Ocean, pasarela de pago, DTE simulado, analítica y pruebas.

## Base de datos — Samuel Alarcón

| Ticket | Historia | Estado |
|---|---|---|
| KAN-139 | Migraciones Drizzle del modelo completo | ✅ [entrada](../cambios/2026-10-22-modelo-completo-en-drizzle.md) |
| KAN-140 | Índices y restricciones especiales | ✅ [entrada](../cambios/2026-10-23-indices-restricciones-y-particiones.md) (sin commitear) |
| KAN-141 | Datos semilla y de prueba | ✅ [entrada](../cambios/2026-10-23-datos-semilla.md) |
| KAN-142 | Modelo de calificaciones | ✅ [entrada](../cambios/2026-10-23-calificaciones-de-proveedores.md) (sin commitear) |
| KAN-143 | Consultas de analítica para los paneles | ✅ [entrada](../cambios/2026-10-23-consultas-de-analitica.md) (sin commitear) |

## API — Benjamín González / Sebastián Ramírez

Hoy existen `GET /health-check` y `GET/POST /categorias`, más los
`preHandler` `requireAuth`/`requireRol`. Ningún ticket de API está cerrado.

| Ticket | Historia | Responsable | Estado |
|---|---|---|---|
| KAN-144 | Autenticación, roles y 2FA | Benjamín | ⏳ Contrato de `POST /auth/login` escrito |
| KAN-145 | Catálogo, búsqueda y comparador | Benjamín | ⏳ Contrato de `GET /productos[/:id]` escrito; FULLTEXT listo |
| KAN-146 | Ofertas del proveedor | Sebastián | ⏳ |
| KAN-147 | Carro y creación de orden con split por proveedor | Sebastián | ⏳ |
| KAN-148 | Pagos: pasarela Webpay/MercadoPago sandbox | Sebastián | ⏳ |
| KAN-149 | Órdenes y estados de envío | Sebastián | ⏳ |
| KAN-150 | Proveedores: perfil, cobertura, retiro y documentos | Sebastián | ⏳ |
| KAN-151 | Usuarios, roles y permisos | Sebastián | ⏳ |
| KAN-152 | Liquidaciones semanales | Sebastián | ⏳ |
| KAN-153 | Documentos tributarios simulados (SII) | Sebastián | ⏳ |
| KAN-154 | Ingesta de eventos analíticos | Sebastián | ⏳ Debe validar las referencias sin FK de `evento_analitico` |
| KAN-155 | Auditoría y moderación automáticas | Sebastián | ⏳ |
| KAN-156 | Correos transaccionales | Sebastián | ⏳ |
| KAN-169 | Decidir Fastify vs Express | Sebastián | ⏳ Ver [decisiones abiertas](../decisiones/DECISIONES-ABIERTAS.md) |

## Infraestructura — Samuel Alarcón

| Ticket | Historia | Estado |
|---|---|---|
| KAN-158 | Servir el build de `apps/ecommerce` en producción | ✅ [entrada](../cambios/2026-10-23-stack-de-produccion-servible.md) |
| KAN-161 | Pipeline de despliegue (CI/CD) | 🔄 CI de tests listo; deploy escrito pero apagado; faltan imágenes en GHCR y migraciones en el deploy |
| KAN-168 | Servir el build de `apps/admin-site` | ⏳ Siguiente |
| KAN-159 | HTTPS con Let's Encrypt | ⏳ |
| KAN-160 | Respaldos automáticos de MySQL | ⏳ |
| KAN-157 | Almacenamiento de imágenes y documentos | ⏳ |
| KAN-162 | Hardening y control de accesos del droplet | ⏳ |
| KAN-163 | Monitoreo y logs | ⏳ |

El orden de la tabla es el orden acordado en
[infra/README.md](../../infra/README.md#pendiente).

## QA — Benjamín González

| Ticket | Historia | Estado |
|---|---|---|
| KAN-164 | Pruebas end-to-end del flujo de compra | ⏳ |
| KAN-165 | Pruebas de usabilidad con usuarios piloto | ⏳ |

## Pendiente transversal

- Commitear lo de KAN-140, KAN-142, KAN-143, el catálogo mobile y los tests/lint de
  Angular, que están en el working tree de `dev-smy`.
- Traer `main` a `dev-smy` (trae el compose secuencial de Sebastián).
- Tarea mensual `pnpm db:particiones` en cada base (ver
  [../desarrollo/OPERAR-LA-BASE.md](../desarrollo/OPERAR-LA-BASE.md)).
