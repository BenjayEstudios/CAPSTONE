# Cuentas de prueba

Las crea `pnpm --filter @cotizapp/infrastructure db:seed` (ver
[OPERAR-LA-BASE.md](OPERAR-LA-BASE.md)). Mobile en modo fake usa una copia
de los mismos datos (`apps/mobile/lib/core/fake/seed.dart`), así que las
cuentas sirven igual con o sin backend.

**Clave de todas:** `Cotizapp.2026` (constante `CLAVE_PRUEBA` en
`packages/infrastructure/src/db/seed/seed.ts`).

| Correo | Rol | Organización | Para qué sirve |
|---|---|---|---|
| admin@cotizapp.test | admin_general | Cotizapp | Panel de administración. Mobile lo rechaza (rol interno). |
| catalogo@cotizapp.test | editor_catalogo | Cotizapp | Catálogo maestro (admin-site, cuando exista). |
| soporte@cotizapp.test | soporte | Cotizapp | Moderación y soporte (admin-site, cuando exista). |
| ventas@losandes.test | proveedor | Los Andes Food Service | Distribuidor principal de la demo (mejor calificado, 4,67). |
| pedidos@vallecentral.test | proveedor | Valle Central Mayorista | Distribuidor con peor calificación (3,80), para contrastar en el comparador. |
| comercial@frigosur.test | proveedor | FrigoSur | Tercer distribuidor (4,40). |
| contacto@laspalmas.test | proveedor (invitado) | Las Palmas | Cuenta **en revisión**: prueba el rechazo de cuentas no activas. |
| compras@elfogon.test | comprador | Restaurante El Fogón | Comprador principal de la demo. |
| compras@dulcehogar.test | comprador | Pastelería Dulce Hogar | Segundo comprador. |

En mobile con `USE_FAKES=true`, el login muestra dos tarjetas de acceso
rápido: **Comprador · El Fogón** y **Distribuidor · Los Andes**.

## Qué datos hay

7 organizaciones, 9 usuarios, 17 productos en 15 categorías, 34 ofertas (cada
producto con 1 a 3 proveedores a precios distintos), 11 órdenes
multiproveedor entre septiembre y octubre de 2026 (9 entregadas, 1 en
preparación, 1 recién pagada), 16 calificaciones (los dos envíos de
`CM-10010` quedan sin calificar, para probar calificar), cortes de
liquidación semanales, DTE, cobertura, documentos, analítica, auditoría y
casos de moderación.

Los IDs son fijos: se pueden referenciar desde los frontends y los tests.

Producto bueno para mostrar el comparador: **Aceite vegetal maravilla**
(Los Andes $12.490, ★ 4,7, 24 h vs. Valle Central $12.890, ★ 3,8, 48 h).

## Rearmarlas

```bash
cd Proyecto
pnpm --filter @cotizapp/infrastructure db:migrate
pnpm --filter @cotizapp/infrastructure db:seed
```

El seed **vacía todas las tablas** antes de cargar. Contra una base remota
(Aiven) se niega a correr salvo con `-- --allow-remote`.
