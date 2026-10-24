# Datos semilla y de prueba (`db:seed`)

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-141

Nuevo comando `pnpm --filter @cotizapp/infrastructure db:seed`: vacía las
21 tablas y carga un escenario coherente — 4 proveedores con ofertas a
precios distintos por producto (para el comparador), 2 clientes, usuarios de
todos los roles, 2 órdenes multiproveedor con envíos, líneas, liquidación y
DTE, y datos de cobertura, analítica, auditoría y moderación. IDs fijos y
claves hasheadas con bcrypt.

El seed creció después con KAN-142 (ver
[calificaciones](2026-10-23-calificaciones-de-proveedores.md)). Las cuentas
están en [../desarrollo/CUENTAS-DE-PRUEBA.md](../desarrollo/CUENTAS-DE-PRUEBA.md).

**Por qué**: que backend, ecommerce, admin-site y mobile trabajen contra
datos reales en vez de mocks, y tener la demo armada.

**Ojo**: si `DATABASE_URL` apunta a un host no local (Aiven) el script se
niega a correr salvo con `--allow-remote`, porque borra todo.

**Toca**: `packages/infrastructure/src/db/seed/*` (nuevo),
`packages/infrastructure/package.json` (script `db:seed`; deps `bcryptjs`,
`tsx`, `@types/node`), `packages/infrastructure/README.md`, `pnpm-lock.yaml`.
