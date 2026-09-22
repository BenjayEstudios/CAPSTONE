# apps/mobile

App Flutter **exclusiva para distribuidores**: estadísticas, visitas al
perfil y calificaciones. No incluye catálogo de compra ni checkout — eso
vive en `apps/web`.

## Estructura

```
lib/
├── core/
│   ├── app.dart            # widget raíz (MaterialApp.router)
│   ├── error/                # Failure — errores tipados
│   ├── network/                # ApiClient (Dio) hacia apps/rest
│   ├── router/                   # go_router
│   └── theme/                      # ThemeData
├── features/                         # una por feature, Clean Architecture
└── main.dart                           # entrypoint (ProviderScope + runApp)
```

## Stack

- Riverpod para DI y estado.
- go_router para navegación.
- Dio como cliente HTTP.

## Cómo correrlo

```bash
flutter pub get
flutter run
```
