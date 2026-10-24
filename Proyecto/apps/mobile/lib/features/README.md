# features

Cada feature sigue Clean Architecture estándar:

```
features/<feature>/
├── data/           # datasources (remote con ApiClient, fake con datos del seed)
│                   #   + implementación de repositorios
├── domain/          # entidades + interfaces de repositorio (puertos)
└── presentation/      # pantallas, widgets, providers de Riverpod
```

Reglas:

- `presentation` solo conoce la interfaz del repositorio (`domain`), nunca
  el datasource concreto.
- El provider del repositorio (en `presentation/<feature>_providers.dart`)
  es el composition root de la feature: elige el datasource remote o fake
  según `AppConfig.usarFakes` (`--dart-define=USE_FAKES`).
- Los datasources devuelven JSON (`Map`) con la forma documentada en
  `API_CONTRACT.md`; el fake arma ese mismo JSON con los datos del seed, así
  el parseo del repositorio se ejercita igual con fake que con la API real.
- Los repositorios lanzan `Failure` (core/error), nunca `DioException`.
  El mapeo JSON -> entidad va dentro de `parsear()` (core/network), que
  convierte una respuesta con forma inesperada en `ServerFailure`.
- Los datos de los fakes salen de `core/fake/seed.dart`, copia con los
  mismos IDs del seed de `packages/infrastructure`.

La app sirve a los dos perfiles del marketplace (epic KAN-87):

| Feature | Perfil | Ticket | Estado |
|---|---|---|---|
| `conexion` — diagnóstico de API / health-check (ejemplo de referencia) | ambos | KAN-125 | listo (API real) |
| `auth` — login, sesión persistida, cuenta y navegación según perfil | ambos | KAN-126 | listo (fake: `POST /auth/login`) |
| `catalogo` — home, categorías, búsqueda, listado con filtros, ficha con comparador | comprador | KAN-127/128/129 | pendiente |
| `carro` — carro multiproveedor | comprador | KAN-130 | pendiente |
| `checkout` — checkout y pago | comprador | KAN-131 | pendiente |
| `pedidos` — mis pedidos | comprador | KAN-132 | pendiente |
| `estadisticas` — ventas, visitas y conversión | proveedor | KAN-133/134 | pendiente |
| `calificaciones` — reseñas recibidas | proveedor | KAN-135 | pendiente |
| `ordenes` — órdenes vigentes del proveedor | proveedor | KAN-136 | pendiente |
| `alertas` — lo que requiere atención | proveedor | KAN-137 | pendiente |
