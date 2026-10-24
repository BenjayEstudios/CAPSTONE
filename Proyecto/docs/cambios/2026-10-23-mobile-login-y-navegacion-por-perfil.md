# Mobile: login y navegación según perfil

**Fecha:** 2026-10-23 · **Épica:** KAN-87 · **Ticket:** KAN-126

Nueva feature `auth` en `apps/mobile`:

- Pantalla de login con validación, errores del backend y atajos a usuarios
  del seed en modo fake.
- Sesión guardada en el almacenamiento seguro del dispositivo
  (Keystore/Keychain) y restaurada al abrir la app; logout desde Cuenta.
- El router redirige según el rol: `comprador` → Inicio / Carro / Pedidos /
  Cuenta; `proveedor` → Resumen / Órdenes / Reseñas / Alertas / Cuenta
  (las pestañas de tickets futuros son placeholders). Ningún perfil puede
  entrar a las rutas del otro.
- Se rechazan los roles internos (usan `admin-site`) y las cuentas no
  activas (Las Palmas, en revisión).
- Un 401 a un request con token cierra la sesión.

**Por qué**: la épica KAN-87 pide una sola app para comprador y
distribuidor. `POST /auth/login` aún no existe en el backend: la app usa un
fake con los usuarios del seed (`USE_FAKES=true`) y el contrato quedó en
`apps/mobile/API_CONTRACT.md`.

**Ojo (backend)**: `POST /categorias` exige `requireRol("administrador")`,
pero el código del rol en el seed es `admin_general`. Ver
[decisiones abiertas](../decisiones/DECISIONES-ABIERTAS.md).

**Toca**: `apps/mobile/lib/features/auth/` (nuevo), `lib/core/router/*`,
`lib/core/network/` (token + expiración, `parseo.dart`),
`lib/core/fake/seed.dart`, `lib/core/widgets/pantalla_pendiente.dart`,
`test/`, `dart_test.yaml`, `pubspec.yaml`/`pubspec.lock`
(`flutter_secure_storage`), `API_CONTRACT.md`, `README.md`,
`lib/features/README.md`.
