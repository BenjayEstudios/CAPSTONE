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

Corre completa sin backend (`USE_FAKES=true` es el default): todo sale de
un backend en memoria cargado con el seed (`lib/core/fake/`), con las mismas
reglas que la API. Lo que hace el comprador lo ve el distribuidor y al
revés. Reiniciar la app vuelve al seed. No hace falta levantar
`apps/backend` ni la base.

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

**Comprador** (tarjeta **Comprador · El Fogón** en el login):

| Paso | Qué hacer | Qué se ve |
|---|---|---|
| 1 | Abrir la app y tocar **Comprador · El Fogón** | Splash, login y entra como `compras@elfogon.test` |
| 2 | **Inicio → Abarrotes → Aceite vegetal maravilla** | Comparador: Los Andes ($12.490, ★ 4,7, 24 h) vs Valle Central ($12.890, ★ 3,8, 48 h); ordenar por **Calificación** |
| 3 | **Agregar al carro** en Los Andes | Aviso "Agregado al carro" y el badge de Carro sube a 4 |
| 4 | Buscador: escribir `queso`; probar **Filtros** | 2 resultados mientras se escribe; categoría, plazo, caja chica, orden |
| 5 | **Carro** | Un grupo por proveedor con plazo y subtotal, despacho ("gratis si sumas…"), ahorro y total. La leche del seed pide 24 cajas y hay 20: aviso y "Ir a pagar" bloqueado |
| 6 | Bajar la leche a 20 con "–" (o quitarla) → **Ir a pagar** | Checkout: quién compra, entrega por proveedor (elegir **Retiro en Bodega Quilicura** para Los Andes: su despacho pasa a $0), pago |
| 7 | **Pagar** | Pasarela simulada con el folio `CM-90012` y el monto |
| 8 | **Aprobar pago** | "¡Pago aprobado!", folio y reparto por proveedor; el carro queda vacío |
| 9 | **Pedidos → CM-90012** | Un envío por proveedor con su seguimiento ("Por despachar") |
| 10 | Cuenta → **Cerrar sesión** | Vuelve al login |

**Distribuidor** (tarjeta **Distribuidor · Los Andes**):

| Paso | Qué hacer | Qué se ve |
|---|---|---|
| 11 | Entrar como Los Andes → **Resumen** | KPIs de noviembre vs el mismo tramo de octubre (con la orden recién pagada); tocar **Octubre**: $218.070 en 3 envíos. Venta semanal (tocar una barra) y productos más vendidos |
| 12 | Resumen → **Visitas → Últimos 90 días** | 1094 vistas, 213 clicks, 19,5% de conversión; vistas por día, por producto y por comuna |
| 13 | **Órdenes** | `CM-90012` de El Fogón (si se pagó en el paso 8) y `CM-10002` listo para retiro; **Empezar a preparar** / **Marcar entregado** con confirmación |
| 14 | **Reseñas** | 4,7 con 6 calificaciones, distribución, 96,5% de entregas a tiempo y los comentarios |
| 15 | **Alertas** | $97.367 por cobrar (próximo martes), stock bajo en leche y posta negra |
| 16 | Volver como comprador → **Pedidos → CM-90012** | El envío de Los Andes en el estado que le puso el distribuidor; si está entregado, **Calificar a Los Andes Food Service** |

Casos extra para mostrar validaciones:

- Clave incorrecta (`compras@elfogon.test` / `otra`): "Correo o clave incorrectos."
- Cuenta en revisión (`contacto@laspalmas.test` / `Cotizapp.2026`): no entra, la cuenta no está activa.
- Rol interno (`admin@cotizapp.test` / `Cotizapp.2026`): no entra, usa el panel de administración.
- Botón Atrás de Android en cualquier pestaña: vuelve a la primera pestaña del perfil.
- **Rechazar pago** en la pasarela: la orden queda guardada y se puede reintentar (también desde Mis pedidos).
- Como `pedidos@vallecentral.test`: **Alertas** muestra la resolución sanitaria vencida (urgente) y un envío por despachar.
- Como `compras@dulcehogar.test`: **Pedidos → CM-10010** tiene envíos entregados sin calificar.

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
│   ├── app.dart          # widget raíz (MaterialApp.router, locale es-CL)
│   ├── analitica/        # eventos del comprador (vistas, búsquedas, clicks) -> POST /eventos/lote
│   ├── config/           # AppConfig: API_URL y USE_FAKES por --dart-define
│   ├── error/            # Failure — errores tipados, con code y detalle del backend
│   ├── fake/             # FakeBackend en memoria + copia del seed (USE_FAKES=true)
│   ├── format/           # CLP, plazos, fechas, RUT
│   ├── network/          # ApiClient (Dio) hacia apps/backend
│   ├── router/           # go_router, redirect por perfil, shells
│   ├── theme/            # ThemeData (paleta de marca)
│   └── widgets/          # marca (logo, ondas), estados, gráficos
├── features/             # una por feature, Clean Architecture (ver su README)
└── main.dart             # entrypoint (ProviderScope + runApp)
test/                     # espejo de lib/
API_CONTRACT.md           # endpoints que usa la app: los que existen y los que faltan
```

Ver `lib/features/README.md` para las reglas de cada feature.

## Stack

- Riverpod para DI y estado.
- go_router para navegación.
- Dio como cliente HTTP.
- intl para formatos en es-CL.
- flutter_secure_storage para guardar la sesión.
- url_launcher para abrir la pasarela de pago en el navegador.

## Configuración

| Variable | Default | Uso |
|---|---|---|
| `API_URL` | `http://10.0.2.2:8000` en Android, `http://localhost:8000` en el resto | Base URL de `apps/backend` |
| `USE_FAKES` | `true` | `true`: datos fake del seed, sin backend. `false`: todo contra la API |

El backend ya tiene carro, órdenes, estadísticas y eventos, pero no un login
para clientes y proveedores (`POST /auth/login`), así que con
`USE_FAKES=false` no se pasa del login. [`API_CONTRACT.md`](API_CONTRACT.md)
indica qué existe (forma real) y qué falta (especificado).

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

## Release (KAN-138)

### Generar el APK

```bash
cd Proyecto/apps/mobile
flutter build apk --release --dart-define=USE_FAKES=true
# -> build/app/outputs/flutter-apk/app-release.apk (~58 MB, sirve en cualquier Android 7+)
```

El APK de la demo va con `USE_FAKES=true`: funciona completo sin backend y
en cualquier teléfono. Para uno más liviano por arquitectura:
`flutter build apk --release --split-per-abi --dart-define=USE_FAKES=true`
(usar el `app-arm64-v8a-release.apk` en teléfonos actuales).

Contra el API productivo, cuando exista el dominio y `POST /auth/login`:

```bash
flutter build apk --release \
  --dart-define=USE_FAKES=false \
  --dart-define=API_URL=http://<APP_DOMAIN>/api
```

(nginx expone el backend en `/api`; con HTTPS, `https://`).

### Firma

`android/app/build.gradle.kts` firma el release con lo que diga
`android/key.properties`:

```properties
storeFile=cotizapp-demo.jks
storePassword=...
keyAlias=cotizapp-demo
keyPassword=...
```

- La keystore de la demo es `android/cotizapp-demo.jks` (PKCS12, RSA 2048,
  válida 10.000 días, `CN=Cotizapp Demo, OU=Capstone, O=Duoc UC`). La generó
  Samuel en su máquina; **ni la keystore ni `key.properties` se versionan**
  (`android/.gitignore`). Para compartirla, por un canal privado, nunca en el
  repo.
- **Sin `key.properties`** el release se firma con la clave debug: compila
  igual en cualquier máquina, pero ese APK no actualiza uno firmado con la
  keystore de la demo (hay que desinstalar primero).
- Para crear otra keystore:

  ```bash
  keytool -genkeypair -keystore android/cotizapp-demo.jks -storetype PKCS12 \
    -alias cotizapp-demo -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Cotizapp Demo, OU=Capstone, O=Duoc UC, L=Santiago, C=CL"
  ```

  (`keytool` viene con Android Studio: `/snap/android-studio/current/jbr/bin/keytool`).
- Verificar con qué se firmó un APK:
  `apksigner verify --print-certs build/app/outputs/flutter-apk/app-release.apk`
  (en `~/Android/Sdk/build-tools/<versión>/`).

### Instalar

- **Emulador o teléfono por cable**: `adb install -r build/app/outputs/flutter-apk/app-release.apk`.
  Si ya hay una versión debug instalada (firma distinta), antes
  `adb uninstall cl.cotizapp.cotizapp_mobile`.
- **Teléfono sin cable**: pasar el `.apk` (Drive, correo, WhatsApp), abrirlo
  y aceptar "Instalar apps de origen desconocido" para esa app. La primera
  vez Play Protect puede advertir que la app no es de la tienda: "Instalar de
  todas formas".
- La versión sale de `pubspec.yaml` (`version: 1.0.0+1`): subir el número de
  build (`+2`, ...) para que un APK nuevo se instale encima del anterior.

## Calidad

```bash
flutter analyze
flutter test
```

`dart_test.yaml` corta cualquier test a 1 minuto para que un test colgado
no bloquee el CI.
