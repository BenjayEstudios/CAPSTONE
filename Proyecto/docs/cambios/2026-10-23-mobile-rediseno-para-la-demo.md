# Mobile: rediseño visual y pulido para la demo

**Fecha:** 2026-10-23 · **Épica:** KAN-87 · **Tickets:** KAN-125, KAN-126

Recorrido completo en el emulador (Pixel 8) con `USE_FAKES=true`.

**Diseño nuevo**: login y splash oscuros (tinta) con el logo de Cotizapp,
ilustración de productos con precios comparados, inputs redondeados, botón
magenta, ondas cian/magenta y tarjetas de acceso rápido de demo que ingresan
con un toque. Pantallas internas con saludo por organización, placeholders
ilustrados, tarjeta de perfil en Cuenta y barra inferior en magenta. Ícono de
la app y splash nativo de Android con la marca (ícono adaptativo, sin el logo
de Flutter ni destello blanco). Paleta en
[../diseno/IDENTIDAD-VISUAL.md](../diseno/IDENTIDAD-VISUAL.md).

**Correcciones**:

- "Calificaciones" se partía en dos líneas en la barra de 5 pestañas → ahora
  "Reseñas".
- El botón Atrás de Android cerraba la app desde cualquier pestaña → ahora
  vuelve a la primera.
- La pantalla de Conexión mostraba un error rojo genérico sin backend → ahora
  dice "Sin conexión con el backend", aclara que la app sigue con datos de
  prueba y distingue cuando en el puerto responde otro servicio.

Nueva sección "Demo" en `apps/mobile/README.md` con los comandos y el
recorrido paso a paso.

**Por qué**: demo de avance de mobile corriendo en el emulador.

**Toca**: `apps/mobile/lib/core/theme/app_theme.dart`,
`lib/core/widgets/{marca,pantalla_pendiente}.dart`,
`lib/core/router/{app_router,perfil_shell}.dart`,
`lib/features/auth/presentation/*`, `lib/features/conexion/*`,
`android/app/src/main/res/*` (íconos, splash, colores), `test/`, `README.md`.
