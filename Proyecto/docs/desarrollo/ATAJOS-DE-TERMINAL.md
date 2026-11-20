# Atajos de terminal

Funciones de bash para levantar el emulador, correr la app mobile y el
backend sin recordar los comandos largos. No viven en el repo: cada uno las
copia a su `~/.bash_aliases`.

## Comandos

| Comando | Qué hace | Equivale a |
|---|---|---|
| `emulator-up` | Levanta el emulador y espera a que Android termine de arrancar. Si ya está arriba, solo avisa | `flutter emulators --launch Pixel_8` + esperar el boot |
| `emulator-down` | Apaga el emulador | `adb -s emulator-5554 emu kill` |
| `mobile-run` | Corre la app mobile en el emulador, desde cualquier carpeta | `cd Proyecto/apps/mobile && flutter pub get && flutter run -d emulator-5554` |
| `mobile-demo` | `emulator-up` + `mobile-run`: lo único que hay que escribir para la demo | — |
| `mobile-test` | Lo mismo que corre el CI para mobile | `flutter analyze && flutter test` en `apps/mobile` |
| `backend-cotizapp` | Levanta el backend en el puerto 8000 | `cd Proyecto/apps/backend && pnpm dev` |

Con `mobile-run` corriendo, en la misma terminal: `r` recarga el código
(hot reload), `R` reinicia la app (hot restart) y `q` la cierra.

`mobile-run` y `mobile-demo` aceptan flags de `flutter run`, por ejemplo
`mobile-run --dart-define=USE_FAKES=false` para ir contra el backend real
(qué variables existen: [apps/mobile/README.md](../../apps/mobile/README.md#configuración)).

## Uso típico

```bash
mobile-demo              # emulador + app, con datos de prueba (no necesita backend)
backend-cotizapp         # opcional, en otra terminal: la pantalla Conexión pasa a "Backend conectado"
emulator-down            # al terminar
```

El recorrido de la demo (qué usuario usar en cada paso) está en la sección
Demo de [apps/mobile/README.md](../../apps/mobile/README.md#demo).

## Instalación

1. Ubuntu ya trae en `~/.bashrc` las líneas que cargan `~/.bash_aliases`;
   confirmarlo con `grep bash_aliases ~/.bashrc`.
2. Copiar el bloque de abajo al final de `~/.bash_aliases` (crearlo si no
   existe).
3. Si el repo no está en `~/Desktop/PROJECTS/CAPSTONE` o el emulador no se
   llama `Pixel_8`, definir antes en `~/.bashrc` las variables que cambien:

   ```bash
   export COTIZAPP_DIR="$HOME/ruta/al/repo/Proyecto"
   export COTIZAPP_AVD="Nombre_del_AVD"         # ver: flutter emulators
   export COTIZAPP_DEVICE="emulator-5554"       # ver: flutter devices
   ```

4. Abrir una terminal nueva, o en la actual: `source ~/.bash_aliases`.

```bash
# Atajos de Cotizapp (app mobile + backend). ~/.bashrc carga este archivo
# solo; para usarlos en una terminal ya abierta: source ~/.bash_aliases

# Si tu repo o tu emulador son otros, define estas variables antes en ~/.bashrc.
COTIZAPP_DIR="${COTIZAPP_DIR:-$HOME/Desktop/PROJECTS/CAPSTONE/Proyecto}"
COTIZAPP_AVD="${COTIZAPP_AVD:-Pixel_8}"
COTIZAPP_DEVICE="${COTIZAPP_DEVICE:-emulator-5554}"

# Levanta el emulador Pixel_8 y espera a que Android termine de arrancar.
emulator-up() {
  if adb devices | grep -q "^$COTIZAPP_DEVICE"; then
    echo "El emulador ya está arriba ($COTIZAPP_DEVICE)."
    return 0
  fi
  flutter emulators --launch "$COTIZAPP_AVD" || return 1
  echo "Esperando a que arranque Android..."
  adb -s "$COTIZAPP_DEVICE" wait-for-device
  until [ "$(adb -s "$COTIZAPP_DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
  echo "Emulador listo ($COTIZAPP_DEVICE)."
}

# Apaga el emulador.
emulator-down() {
  adb -s "$COTIZAPP_DEVICE" emu kill
}

# Corre la app mobile en el emulador (r = recargar, R = reiniciar, q = salir).
# Acepta flags extra, ej.: mobile-run --dart-define=USE_FAKES=false
mobile-run() {
  (cd "$COTIZAPP_DIR/apps/mobile" && flutter pub get && flutter run -d "$COTIZAPP_DEVICE" "$@")
}

# Todo junto: levanta el emulador (si no está) y corre la app.
mobile-demo() {
  emulator-up && mobile-run "$@"
}

# Lo mismo que corre el CI: analyze + test.
mobile-test() {
  (cd "$COTIZAPP_DIR/apps/mobile" && flutter analyze && flutter test)
}

# Backend de Cotizapp en el puerto 8000. Ojo: backend-rest (cmv-reguard)
# usa el mismo puerto, no se pueden tener los dos arriba a la vez.
backend-cotizapp() {
  (cd "$COTIZAPP_DIR/apps/backend" && pnpm dev)
}
```

## Problemas comunes

- **`emulator-up` dice que no encuentra el AVD**: `flutter emulators` lista
  los que existen; ajustar `COTIZAPP_AVD`. Si no hay ninguno, crearlo desde
  Android Studio (Device Manager).
- **`backend-cotizapp` falla con `EADDRINUSE` o la app muestra "Responde
  otro servicio"**: otro proceso ocupa el 8000 (`ss -ltnp | grep :8000`
  dice cuál). Cerrarlo antes de levantar el backend.
- **`backend-cotizapp` no arranca por la base**: el backend hace `SELECT 1`
  al iniciar contra `DATABASE_URL` de `apps/backend/.env`; ver
  [OPERAR-LA-BASE.md](OPERAR-LA-BASE.md).
- **`mobile-run` no encuentra el dispositivo**: el emulador no terminó de
  arrancar; usar `mobile-demo`, que espera.
