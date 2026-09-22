# features

Cada feature sigue Clean Architecture estándar:

```
features/<feature>/
├── data/           # datasources (ApiClient) + implementación de repositorios
├── domain/          # entidades + interfaces de repositorio (puertos)
└── presentation/      # pantallas, widgets, providers de Riverpod
```

Previstas para el distribuidor (esta app **no** incluye catálogo de compra
ni checkout — eso es exclusivo de `apps/web`):

- `estadisticas` — ventas, visitas al perfil, desempeño por producto.
- `calificaciones` — reseñas recibidas de clientes.
- `perfil` — datos públicos del distribuidor, documentos, cobertura.

Ninguna implementada todavía.
