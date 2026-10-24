# apps/mobile

App Flutter de Cotizapp para los dos perfiles del marketplace (epic KAN-87):

- **Comprador** (cliente pyme): home, categorías y búsqueda, listado con
  filtros, ficha con comparador de proveedores, carro multiproveedor,
  checkout con un solo pago y mis pedidos.
- **Distribuidor** (proveedor): estadísticas de venta, visitas y conversión,
  calificaciones recibidas, órdenes vigentes y alertas.

Después del login la app navega según el rol del usuario: `comprador` ve
Inicio / Carro / Pedidos / Cuenta y `proveedor` ve Resumen / Órdenes /
Reseñas / Alertas / Cuenta. Los roles internos (admin, editor,
soporte) se rechazan: usan `apps/admin-site`. La sesión queda guardada en
el almacenamiento seguro del dispositivo (Keystore / Keychain) y un 401 de
la API la cierra.

## Demo

Corre completa sin backend (`USE_FAKES=true` es el default): login,
navegación de los dos perfiles y cuenta usan los datos del seed. No hace
falta levantar `apps/backend` ni la base.

Atajo: con las funciones de
[docs/desarrollo/ATAJOS-DE-TERMINAL.md](../../docs/desarrollo/ATAJOS-DE-TERMINAL.md)
instaladas, los pasos 1 y 2 se reducen a `mobile-demo`.

### 1. Levantar el emulador

```bash
flutter emulators                     # debe listar Pixel_8
flutter emulators --launch Pixel_8    # o abrirlo desde Android Studio
flutter devices                       # esperar a que aparezca emulator-5554
```

### 2. Correr la app

```bash
cd Proyecto/apps/mobile
flutter pub get
flutter run -d emulator-5554
```

Si quedó una sesión abierta de una prueba anterior, la app entra directo a
ese perfil: ir a **Cuenta → Cerrar sesión** antes de empezar. Si la app ya
está corriendo, `R` en la terminal de `flutter run` la reinicia (hot
restart) sin reinstalar.

### 3. Recorrido

| Paso | Qué hacer | Qué se ve |
|---|---|---|
| 1 | Abrir la app | Splash con el logo de Cotizapp y luego el login |
| 2 | Tocar la tarjeta **Comprador · El Fogón** | Llena `compras@elfogon.test` / `Cotizapp.2026` e ingresa |
| 3 | En **Inicio**, tocar la categoría **Abarrotes** | Listado con 4 productos, cada uno con precio desde, proveedores, plazo y ahorro |
| 3a | Tocar **Aceite vegetal maravilla** | Ficha con comparador: Los Andes ($12.490, ★ 4,7, 24 h) vs Valle Central ($12.890, ★ 3,8, 48 h), insignias "Más bajo / Más rápido / Mejor calificado"; cambiar el orden a **Calificación** |
| 3b | Volver al inicio, tocar el buscador y escribir `queso` | 2 resultados mientras se escribe; probar **Filtros** (categoría, plazo 24/48 h, caja chica, orden) y el botón de balanza para ver precio por kg / L |
| 3c | Recorrer **Carro** y **Pedidos** | Secciones en construcción (KAN-130 a 132) |
| 4 | **Cuenta** | Perfil del usuario, organización y rol |
| 5 | Cuenta → **Diagnóstico de conexión** | A qué API apunta la app; sin backend muestra "Sin conexión con el backend" y aclara que la app sigue con datos de prueba |
| 6 | Volver → **Cerrar sesión** | Vuelve al login |
| 7 | Tocar la tarjeta **Distribuidor · Los Andes** | Ingresa como `ventas@losandes.test` |
| 8 | Recorrer **Resumen, Órdenes, Reseñas, Alertas** | Saludo "Hola, Los Andes Food Service" y las secciones del distribuidor (KAN-133 a 137) |
| 9 | **Cuenta → Cerrar sesión** | Vuelve al login |

Casos extra para mostrar validaciones:

- Clave incorrecta (`compras@elfogon.test` / `otra`): "Correo o clave incorrectos."
- Cuenta en revisión (`contacto@laspalmas.test` / `Cotizapp.2026`): no entra, la cuenta no está activa.
- Rol interno (`admin@cotizapp.test` / `Cotizapp.2026`): no entra, usa el panel de administración.
- Botón Atrás de Android en cualquier pestaña: vuelve a la primera pestaña del perfil.

## Usuarios de prueba

Los del seed (`packages/infrastructure/README.md`), clave `Cotizapp.2026`.
Con `USE_FAKES=true` el login muestra tarjetas de acceso rápido (Comprador ·
El Fogón y Distribuidor · Los Andes) que llenan el formulario e ingresan.

| Correo | Perfil en la app |
|---|---|
| compras@elfogon.test | Comprador (El Fogón) |
| compras@dulcehogar.test | Comprador (Dulce Hogar) |
| ventas@losandes.test | Distribuidor (Los Andes) |
| pedidos@vallecentral.test | Distribuidor (Valle Central) |
| comercial@frigosur.test | Distribuidor (FrigoSur) |
| contacto@laspalmas.test | Rechazado: cuenta en revisión |
| admin@cotizapp.test | Rechazado: rol interno |

## Estructura

```
lib/
├── core/
│   ├── app.dart              # widget raíz (MaterialApp.router, locale es-CL)
│   ├── config/                 # AppConfig: API_URL y USE_FAKES por --dart-define
│   ├── error/                    # Failure — errores tipados
│   ├── fake/                       # copia de los datos del seed para los fakes
│   ├── format/                     # CLP, plazos, fechas
│   ├── network/                      # ApiClient (Dio) hacia apps/backend
│   ├── router/                         # go_router, redirect por perfil, shells
│   ├── theme/                            # ThemeData (paleta del mockup móvil)
│   └── widgets/                            # marca (logo, ondas), estados, placeholders
├── features/                                 # una por feature, Clean Architecture
└── main.dart                                   # entrypoint (ProviderScope + runApp)
test/                                             # espejo de lib/
API_CONTRACT.md                                     # endpoints que la app necesita del backend
```

Ver `lib/features/README.md` para las reglas de cada feature.

## Stack

- Riverpod para DI y estado.
- go_router para navegación.
- Dio como cliente HTTP.
- intl para formatos en es-CL.
- flutter_secure_storage para guardar la sesión.

## Configuración

| Variable | Default | Uso |
|---|---|---|
| `API_URL` | `http://10.0.2.2:8000` en Android, `http://localhost:8000` en el resto | Base URL de `apps/backend` |
| `USE_FAKES` | `true` | `true`: datos fake del seed, sin backend. `false`: todo contra la API |

El backend todavía no expone auth, productos, ofertas, carro ni órdenes;
mientras tanto la app trabaja con fakes. Lo que la app espera de cada
endpoint está en [`API_CONTRACT.md`](API_CONTRACT.md).

## Cómo correrlo

```bash
flutter pub get

# Con fakes (no necesita backend)
flutter run

# Contra el backend local desde el emulador Android
flutter run --dart-define=USE_FAKES=false

# Dispositivo físico (IP de tu máquina en la red local)
flutter run --dart-define=USE_FAKES=false --dart-define=API_URL=http://192.168.1.50:8000

# O todo desde .env
cp .env.example .env
flutter run --dart-define-from-file=.env
```

La pantalla **Conexión** muestra a qué API apunta la app, si usa fakes y
si `GET /health-check` responde.

## Calidad

```bash
flutter analyze
flutter test
```

`dart_test.yaml` corta cualquier test a 1 minuto para que un test colgado
no bloquee el CI.
