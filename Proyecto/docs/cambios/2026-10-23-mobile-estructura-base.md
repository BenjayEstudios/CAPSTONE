# Mobile: estructura base de la app

**Fecha:** 2026-10-23 · **Épica:** KAN-87 · **Ticket:** KAN-125

`apps/mobile` pasa de esqueleto a base lista para las features:

- Carpeta `android/` generada (`cl.cotizapp.cotizapp_mobile`, label
  "Cotizapp", permiso INTERNET).
- `AppConfig` con `API_URL` y `USE_FAKES` por `--dart-define` (default
  `10.0.2.2:8000` en Android, `localhost:8000` en el resto).
- `ApiClient` (Dio) con interceptor de token y traducción del formato de
  error del backend (`{error:{code,message}}`) a `Failure` tipados.
- Tema con la paleta del mockup móvil, formatos es-CL (CLP, plazos, fechas),
  vistas de carga/error/vacío.
- Feature de referencia `conexion`: pantalla de diagnóstico contra
  `GET /health-check`.
- `API_CONTRACT.md`: convenciones y endpoints que la app necesita del
  backend.
- Primeros tests (`flutter test`, 14 casos).

**Por qué**: Jira (épica KAN-87) amplió la app a comprador **y**
distribuidor; se corrigieron `pubspec.yaml`, `README.md` y
`lib/features/README.md`, que decían "solo distribuidores". Los fakes con
datos del seed permiten avanzar las pantallas sin esperar los endpoints.

**Ojo**: el esqueleto usaba comillas dobles y `analysis_options.yaml` exige
`prefer_single_quotes` (12 avisos en `flutter analyze`); se pasó todo a
comillas simples.

**Toca**: `apps/mobile/` (`android/`, `lib/core/*`, `lib/features/conexion/`,
`test/`, `pubspec.yaml` + `pubspec.lock` — deps `intl`,
`flutter_localizations` —, `analysis_options.yaml`, `.gitignore`,
`.metadata`, `.env.example`, `README.md`, `API_CONTRACT.md`).
