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
- Los fakes no inventan respuestas: delegan en `core/fake/FakeBackend`, un
  backend en memoria cargado con una copia del seed (mismos IDs, en
  `core/fake/seed*.dart`) que aplica las reglas de `packages/application` y
  responde los mismos errores. Lo comparten todas las features, así que lo
  que hace un perfil lo ve el otro. Cada fake recibe el usuario actual
  (`usuarioFakeProvider`, sale del token como en el backend) y la latencia
  (`latenciaFakeProvider`, cero en los tests).

La app sirve a los dos perfiles del marketplace (epic KAN-87):

| Feature | Perfil | Ticket | API (✅ existe · ⏳ falta, usa fake) |
|---|---|---|---|
| `conexion` — diagnóstico de API (ejemplo de referencia) | ambos | KAN-125 | ✅ `/health-check` |
| `auth` — login, sesión, cuenta y navegación según perfil | ambos | KAN-126 | ⏳ `POST /auth/login` |
| `catalogo` — inicio, categorías, búsqueda, filtros, ficha con comparador | comprador | KAN-127/128/129 | ✅ `/categorias` · ⏳ `/catalogo/productos` |
| `carro` — carro multiproveedor | comprador | KAN-130 | ✅ `GET/PUT /carro` |
| `checkout` — checkout, pasarela y resultado del pago | comprador | KAN-131 | ✅ `/carro/confirmar` · ⏳ opciones de entrega, comunas, `/ordenes/:id/pago` |
| `ordenes` — mis pedidos (`presentation/cliente`) y órdenes vigentes (`presentation/proveedor`) | ambos | KAN-132, KAN-136 | ✅ `/ordenes`, `PATCH .../estado` · ⏳ calificar envío |
| `estadisticas` — ventas, visitas y conversión (pestaña Resumen) | proveedor | KAN-133/134 | ✅ `/estadisticas/proveedor` · ⏳ `.../ventas` |
| `calificaciones` — reseñas recibidas | proveedor | KAN-135 | ⏳ `/calificaciones/recibidas` |
| `alertas` — requiere atención y por cobrar | proveedor | KAN-137 | ⏳ `/alertas/proveedor` |

Fuera de las features, en `core/`: `analitica` (eventos del comprador por
✅ `POST /eventos/lote`) y `widgets/graficos.dart` (gráficos del panel).
Detalle de cada endpoint en [`API_CONTRACT.md`](../../API_CONTRACT.md).
