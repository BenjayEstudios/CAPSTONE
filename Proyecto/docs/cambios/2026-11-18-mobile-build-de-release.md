# Mobile: build de release para la demo

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-138

APK de release firmado, versión 1.0.0 (build 1):

- **Firma**: `android/app/build.gradle.kts` lee `android/key.properties`
  (keystore, alias y claves). La keystore de la demo es
  `android/cotizapp-demo.jks` (PKCS12, RSA 2048, 10.000 días,
  `CN=Cotizapp Demo`). **Ninguno de los dos se versiona** (`android/.gitignore`).
  Sin `key.properties` el release se firma con la clave debug, así que
  cualquiera puede compilarlo.
- El APK de la demo se compila con `USE_FAKES=true`: funciona completo sin
  backend y en cualquier teléfono.
- Probado instalado en el emulador: arranca, navega y llega al API por HTTP
  en modo release.

**Pendiente del criterio "apuntando al API productivo"**: no hay dominio de
producción ni `POST /auth/login` para clientes y proveedores. El comando
para ese build quedó listo en el README
(`--dart-define=USE_FAKES=false --dart-define=API_URL=http://<dominio>/api`).

**Toca**: `apps/mobile/android/app/build.gradle.kts`, `apps/mobile/pubspec.yaml` (versión),
`apps/mobile/README.md` (sección Release).
