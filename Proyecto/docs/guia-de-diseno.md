# Guía de diseño gráfico — Cotizapp / CompraMejor

Resumen del estilo visual del proyecto, para aplicarlo de forma consistente en el `admin-site`.

## 0. De dónde sale este diseño (leer primero)

- **`apps/ecommerce` no tiene diseño todavía.** En `dev`, `main`, `dev-smy` y `dev-sebamax` es un andamio: `styles.css` está vacío y lo único con CSS es la tarjeta de estado (`system-ui`, grises slate). No sirve de referencia.
- **La fuente real del diseño son los 4 mockups HTML de Fase 1**: `Fase1/Documentos Diseno/Mockups/CompraMejor {Administrador,Cliente,Proveedor,ClienteMovil}.html`. Los cuatro comparten exactamente los mismos tokens (verificado con `diff` del bloque `:root`).
- El mockup se apoya en un sistema de diseño llamado **"Broadsheet"**: estética de periódico impreso con tintas de imprenta (cian, magenta, amarillo).
- `apps/mobile` (Flutter) ya implementa la misma paleta en `lib/core/theme/app_theme.dart` y `lib/core/widgets/marca.dart`, con adaptaciones propias (ver §9).
- Para el admin-site el modelo directo es **`CompraMejor Administrador.html`**.

> Nombre de marca: los mockups dicen **CompraMejor**; el repo y la app mobile dicen **Cotizapp**. `admin-site/src/app/core/config/brand.ts` hoy usa "CompraMejor". Es una decisión pendiente, no de diseño.

## 1. Idea general

Una **hoja de periódico**: fondo de papel gris cálido, tinta casi negra, tipografía serif para todo, filetes (líneas) en vez de cajas, esquinas casi rectas y sombras mínimas. El color aparece poco y con intención: **cian** como acento principal y **magenta** como acento de atención. El amarillo es solo un recurso de impresión.

Rasgos distintivos:

1. Todo en **serif** (Source Serif 4), sin sans-serif.
2. **Filetes**: una línea gruesa de 4 px arriba, líneas de 1 px, 2 px negra sobre cada bloque de orden. La estructura la dan las líneas, no las tarjetas.
3. **Radios mínimos**: 1, 2 y 4 px. Nada de píldoras en desktop.
4. **Etiquetas en versalitas** (mayúsculas pequeñas con tracking) para metadatos y cabeceras de tabla.
5. **Cifras "CMYK"**: los números grandes (KPIs, precios) se imprimen como placas desalineadas cian/magenta/amarillo.
6. **Trama halftone** sobre las imágenes de producto.

## 2. Color

### Tokens base

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#f3f2f2` | Fondo de página (papel) |
| `--color-surface` | `#eae9e9` | Inputs, tarjetas, diálogos, marcos de imagen |
| `--color-text` | `#201e1d` | Texto y filetes fuertes |
| `--color-accent` | `#0088b0` | Cian: botón primario, enlaces, foco, pestaña activa |
| `--color-accent-2` | `#d6006c` | Magenta: atención, alertas, pendiente |
| `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` | Líneas finas y bordes |
| `--color-process-yellow` | `#edbb00` | Solo placas de impresión; nunca texto ni interfaz |

### Rampas tonales (100 = más claro, 900 = más oscuro)

```css
--color-neutral-100: #f8f4f4;  --color-neutral-200: #eae7e7;  --color-neutral-300: #d7d3d3;
--color-neutral-400: #bab6b6;  --color-neutral-500: #9b9797;  --color-neutral-600: #7d7979;
--color-neutral-700: #605d5d;  --color-neutral-800: #444141;  --color-neutral-900: #2d2b2b;

--color-accent-100: #e9f8ff;   --color-accent-200: #cbeeff;   --color-accent-300: #99e0ff;
--color-accent-400: #62c5ee;   --color-accent-500: #38a6cf;   --color-accent-600: #1186ac;
--color-accent-700: #006786;   --color-accent-800: #004961;   --color-accent-900: #0a303e;

--color-accent-2-100: #fff1f4; --color-accent-2-200: #ffdee6; --color-accent-2-300: #ffc0d0;
--color-accent-2-400: #ff90b1; --color-accent-2-500: #ff458e; --color-accent-2-600: #d82071;
--color-accent-2-700: #aa0b56; --color-accent-2-800: #790e3d; --color-accent-2-900: #4b1528;
```

### Significado semántico (así lo usa el mockup del admin)

No hay verde ni rojo. El estado se comunica con cian, magenta y neutro:

| Significado | Etiqueta | Texto suelto | Ejemplos del mockup |
|---|---|---|---|
| Positivo / activo / publicado | `tag-accent` (fondo 100, texto 800) | `--color-accent-700` | Activo, Publicado, entregado a tiempo |
| Atención / problema / pendiente | `tag-accent-2` (fondo 100, texto 800) | `--color-accent-2-700` | Suspendido, Sin imagen, alta de proveedor, precio fuera de rango, reembolsada |
| Neutro / cerrado / borrador | `tag-neutral` | `color-mix(text 70%)` | Entregada, borrador, inactivo |
| Filtro no seleccionado | `tag-outline` | `--color-accent` con borde | Chips de filtro apagados |

Reglas:
- **Primario = cian.** Magenta nunca es botón principal en desktop.
- Texto atenuado: `color-mix(in srgb, var(--color-text) N%, transparent)` con N entre 40 y 72. Metadatos 50-60 %, párrafos de apoyo 70 %.
- El **foco** siempre es `outline: 2px solid var(--color-accent)` con `outline-offset: 2px`.
- El mockup usa 4.5:1 como piso para texto pequeño (el placeholder está a 65 % de tinta por eso). Mantenerlo.

## 3. Tipografía

**Familia única: Source Serif 4** (Google Fonts), pesos **400** y **600**, más cursiva 400.

```css
--font-heading: "Source Serif 4", system-ui, sans-serif;
--font-heading-weight: 600;
--font-body: "Source Serif 4", system-ui, sans-serif;
```

> **Estado actual del admin-site:** `styles.css` declara la familia pero **no la carga** (sin `@font-face`, sin `<link>`, sin `@fontsource`). Hoy se ve en Georgia. Hay que cargarla; ver §10.

| Elemento | Tamaño | Notas |
|---|---|---|
| Base (`body`) | 15 px / line-height 1.55 / peso 400 | |
| `h1` | 42 px | |
| `h2` | 32 px | En pantallas del admin se usa **34 px** como título de sección |
| `h3` | 25 px | En paneles se usa **20 px** para subtítulos |
| `h4` | 20 px | |
| `h5` | 16 px | |
| `h6` | 13 px | MAYÚSCULAS, tracking `0.08em` |
| Encabezados | peso 600, line-height 1.12, `letter-spacing: -0.015em`, margen inferior 10 px | |
| Logotipo / nombre de marca | 36-40 px, peso 600, `letter-spacing: -0.02em` | Sufijo ("administración") en 17 px, peso 400, color a 55 % |
| Botones, inputs | 14 px | |
| Etiquetas de campo | 12 px, color a 70 % | |
| Cabecera de tabla, "kickers", metadatos de franja | 11 px, MAYÚSCULAS, `letter-spacing: 0.08em` (0.1em en kickers de tarjeta a 10 px) | |
| Pie de figura, meta | 11 px, color a 50-55 % | |
| Cifras grandes (KPI) | 48 px (admin), 56-66 px (cliente), peso 600 | `font-feature-settings: "pnum"` en `.cmyk-num` |

Para tablas con importes conviene `font-variant-numeric: tabular-nums` y alinear a la derecha (ya lo hace el admin-site con `.num`).

## 4. Espaciado, radios y sombras

```css
--space-1: 5px;  --space-2: 10px;  --space-3: 15px;
--space-4: 20px; --space-6: 30px;  --space-8: 40px;

--radius-sm: 1px;  --radius-md: 2px;  --radius-lg: 4px;   /* lg solo en diálogos */

--shadow-sm: 0 1px 2px  color-mix(in srgb, #2d2b2b 14%, transparent);
--shadow-md: 0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent);
--shadow-lg: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent);
```

Múltiplos de 5 px. Controles y tarjetas usan `--radius-md` (2 px); diálogos `--radius-lg` (4 px). Las sombras solo en diálogos y elementos elevados; el resto se separa con filetes.

## 5. Estructura de página (admin)

Contenedor centrado: `max-width: 1400px; margin: 0 auto; padding: 0 40px`. Fondo `--color-bg`. De arriba abajo:

1. **Filete superior**: `height: 4px; background: var(--color-text); margin-top: 22px`.
2. **Franja de datos** (11 px, mayúsculas, tracking `.08em`, color a 60 %): "Administración del sistema · Sesión: … · Rol: …", y a la derecha la fecha larga (`margin-left: auto`). Debajo, un filete de 1 px en color de texto.
3. **Cabecera de marca**: nombre en 36 px + sufijo; bajo él una bajada de 12 px (color a 60 %) que describe el sitio. A la derecha, acciones globales: `btn-secondary` + `btn-primary`.
4. **Navegación por pestañas** (14 px, serif, peso 600): botones sin caja con `border-bottom: 2px`. Activa: texto `--color-accent-700` y subrayado `--color-accent`; inactiva: texto a 72 % y subrayado transparente. Gap `8px 28px`, padding inferior 16 px. Debajo, filete divisor de 1 px y 36 px de margen.
5. **Contenido de la sección**, con `padding-bottom: 60px`:
   - Fila de título: `h2` 34 px + contador (13 px, a 55 %) + acción primaria a la derecha (`margin-left: auto`), alineados por `baseline`.
   - Párrafo de contexto: 14 px, `max-width: 64-72ch`, color a 70 %.
   - Fila de filtros (chips `tag`), margen `22px 0 4px`.
   - Tabla o lista.

Responsivo: casi todo es `display:flex; flex-wrap:wrap` con `gap`; las tablas anchas van en un contenedor con `overflow-x: auto` y `min-width` (980 px en el catálogo).

## 6. Componentes

CSS tomado de los mockups. El admin-site ya tiene `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-block`, `.field`, `.input`; **faltan** `.btn-ghost`, `.btn-icon`, `.tag*`, `.card`, `.seg`, `.radio`, `.table`, `.dialog*`, `.hr`, `.text-muted`, `:focus-visible`, `::selection`.

### Botones

```css
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;
  text-decoration:none; font-family:var(--font-heading); font-weight:600; font-size:14px; line-height:1.2;
  color:var(--color-text); background:transparent; border:1px solid transparent;
  padding:var(--space-2) calc(var(--space-3) * 1.2); border-radius:var(--radius-md); }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.btn-primary { background:var(--color-accent); color:var(--color-bg); }
.btn-primary:hover  { background:var(--color-accent-600); }
.btn-primary:active { background:var(--color-accent-700); }
.btn-secondary { border-color:var(--color-divider); }
.btn-secondary:hover  { background:color-mix(in srgb, var(--color-text) 7%, transparent); }
.btn-secondary:active { background:color-mix(in srgb, var(--color-text) 14%, transparent); }
.btn-ghost { color:var(--color-accent); padding-inline:var(--space-1); }
.btn-ghost:hover  { background:color-mix(in srgb, var(--color-accent) 10%, transparent); }
.btn-ghost:active { background:color-mix(in srgb, var(--color-accent) 18%, transparent); }
.btn-icon { width:36px; height:36px; padding:0; }
.btn-block { width:100%; margin-top:var(--space-2); }
```

Uso: una acción primaria por zona; las acciones de fila (Editar, Revisar) son `btn-ghost`; las secundarias globales (Crear usuario) `btn-secondary`.

### Formularios

- `.field > label`: 12 px, color a 70 %, `margin-bottom: 5px`.
- `.input`: `min-height: 36px; padding: 6px 10px; font-size: 14px; background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: 2px; caret-color: var(--color-accent)`. Hover: borde a 45 % de tinta. Foco: borde `--color-accent`, `outline-offset: 0`. `textarea.input`: `min-height: 90px; resize: vertical`.
- Placeholder: tinta al 65 %, `opacity: 1`.
- **Radio** propio (`.radio` + `.dot` 16 px, borde 1.5 px; marcado = punto cian con anillo interior del color de fondo).
- **Control segmentado** `.seg`: grupo con borde de 1 px, opciones separadas por línea; la opción marcada va con fondo cian y texto `--color-bg`.

### Etiquetas (`tag`)

```css
.tag { display:inline-flex; align-items:center; font-size:11px; letter-spacing:.02em;
  padding:3px 10px; border-radius:calc(var(--radius-md) * .75); }
.tag-accent   { background:var(--color-accent-100);   color:var(--color-accent-800); }
.tag-accent-2 { background:var(--color-accent-2-100); color:var(--color-accent-2-800); }
.tag-neutral  { background:var(--color-neutral-100);  color:var(--color-neutral-800); }
.tag-outline  { border:1px solid var(--color-accent); color:var(--color-accent); }
```

Se usan tanto como **estado** (Activo/Suspendido/Publicado) como **filtro** (seleccionado = `tag-accent`, no seleccionado = `tag-outline`).

### Tablas

```css
.table { width:100%; border-collapse:collapse; font-size:14px; }
.table th { text-align:left; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:color-mix(in srgb, var(--color-text) 60%, transparent);
  padding:var(--space-2); border-bottom:1px solid var(--color-divider); }
.table td { padding:var(--space-2); border-bottom:1px solid color-mix(in srgb, var(--color-text) 8%, transparent); }
.table tbody tr:hover { background:color-mix(in srgb, var(--color-text) 4%, transparent); }
```

Convenciones dentro de la tabla: nombre del registro en peso 600 serif; datos secundarios con `.text-muted` (tinta al 55 %); importes y contadores alineados a la derecha, importes en 600; etiquetas de estado a la derecha del dato; acciones al extremo como `btn-ghost`. Primera columna opcional con miniatura de 44 px (`.halftone`).

> Nota: el admin-site hoy pone `border-bottom: 2px solid var(--color-text)` en `th` (más pesado que el mockup, que usa 1 px divisor). Es una variante válida dentro de la estética de periódico; elegir una y mantenerla.

### Listas con filetes (alternativa a la tabla)

Es el patrón más característico. Cada fila es `border-top: 1px solid var(--color-divider); padding: 12-13px 0`, con `display:flex; flex-wrap:wrap; gap: 6px 14px; align-items: baseline`. El nombre usa `flex: 1 1 180px`, y el dato final `margin-left: auto`. Se usa en "Proveedores por volumen", "Cola de moderación" y "Salud del catálogo".

**Bloque de orden** (pantalla Órdenes): cabecera con `border-top: 2px solid var(--color-text); padding-top: 14px` y folio en 21 px 600; debajo, una línea por envío con `padding-left: 22px` y `border-top: 1px` divisor; al pie una línea de 12 px con comisión y monto a liquidar. Entre órdenes, `gap: 26px`.

### Tarjetas

`.card`: columna con `gap: 10px; padding: 15px; background: var(--color-surface); border-radius: 2px`. Partes: `.card-kicker` (10 px, mayúsculas, tracking `.1em`, cian), `.card-title` (17 px, 600), `.card-body` (13 px, opacidad .8), `.card-meta` (11 px, a 50 %). Elevación opcional `.elev-sm|md|lg`. Se usan poco: el diseño prefiere filetes.

### Diálogos

```css
.dialog-backdrop { position:fixed; inset:0; display:grid; place-items:center; padding:var(--space-4);
  background:color-mix(in srgb, var(--color-neutral-900) 50%, transparent); }
.dialog { width:min(440px,100%); display:flex; flex-direction:column; gap:var(--space-3);
  padding:var(--space-4); border-radius:var(--radius-lg); background:var(--color-surface); box-shadow:var(--shadow-lg); }
.dialog-title { font-family:var(--font-heading); font-weight:600; font-size:20px; }
.dialog-body { font-size:14px; opacity:.85; }
.dialog-actions { display:flex; justify-content:flex-end; gap:var(--space-2); margin-top:var(--space-2); }
```

Los formularios largos del admin (crear producto: `min(940px,100%)`, crear usuario: `min(720px,100%)`) usan el mismo diálogo con `padding: 34px`, título de 26 px, `align-items: start; overflow-y: auto; padding: 48px 24px` en el backdrop, `z-index: 60`.

### Gráficos

Sin librería. Barras con `div` de fondo plano: columnas semanales de altura proporcional (`height: 190px`, `gap: 10px`, etiqueta de 10 px debajo), y barras de progreso horizontales de 6 px de alto, pista `--color-neutral-200`, relleno `--color-accent`. Sin ejes, sin rejilla, sin sombras.

## 7. Efectos de marca (opcionales)

- **`.halftone`** (imágenes de producto y miniaturas): `filter: grayscale(.35) contrast(1.15)` más una capa `::after` con `radial-gradient(circle, rgba(0,0,0,.22) 30%, transparent 32%)` de 3 px y `mix-blend-mode: multiply`. Marcos vacíos: `background: var(--color-surface)` con la leyenda "IMAGEN" en 10-11 px, mayúsculas, tracking `.1em`, a 40 %.
- **`.cmyk-num` y `.cmyk-head`** (KPI y precios destacados): el valor se repite en cuatro capas: `.paper` (texto real, color de fondo, con `text-shadow` del color de papel) y tres `.plate` (`aria-hidden`) en cian, magenta y amarillo con `mix-blend-mode: multiply` y un pequeño desplazamiento (`translate` en `em`). El resultado es una cifra negra con flecos de color, como impresión desalineada.

  ```html
  <div class="cmyk-num" style="font-weight:600;font-size:48px">
    <span class="paper">1.248</span>
    <span class="plate plate-c" aria-hidden="true">1.248</span>
    <span class="plate plate-m" aria-hidden="true">1.248</span>
    <span class="plate plate-y" aria-hidden="true">1.248</span>
  </div>
  ```

  Las reglas completas están en el bloque `<style>` de los mockups (buscar `.cmyk-num`). Usan `text-box: trim-both cap alphabetic`, propiedad reciente: comprobar el soporte en el navegador objetivo o prescindir del recorte.
- **Separación fotográfica `.cmyk` / `print-plates.js`**: efecto de fotografía en placas con filtros SVG. Es para el ecommerce; **no hace falta en el admin**.
- Usarlos con moderación: en el admin el mockup solo aplica `.cmyk-num` a los 4 KPI del panel, y `.halftone` a las miniaturas del catálogo.

## 8. Tono y formato de contenido

- Todo en **español de Chile**, tuteo ("Puedes ajustarlos…").
- Títulos de sección sustantivos y sobrios: "Estado de la plataforma", "Catálogo maestro", "Órdenes de la plataforma", "Cola de moderación".
- Cada pantalla abre con un párrafo breve que explica el modelo (p. ej. "Una orden del cliente puede repartirse entre varios proveedores…").
- Fecha larga en la franja: "Sábado 12 de septiembre de 2026".
- Moneda CLP con `$` y punto de miles; montos grandes abreviados: `$28,4 M`; deltas: "+12 % vs. agosto".
- Etiquetas y cabeceras de columna en versalitas; botones con verbo + objeto: "Crear producto", "Aprobar", "Fusionar", "Notificar", "Autorizar".

## 9. Variante mobile (para no confundir)

La app Flutter parte de los mismos tokens pero **se adapta** a móvil y difiere del desktop:

| Aspecto | Desktop / admin (mockup) | Flutter (`app_theme.dart`) |
|---|---|---|
| Acción principal | Cian `#0088b0` | **Magenta `#d6006c`** |
| Tipografía | Source Serif 4 | Fuente por defecto de Material 3 |
| Radios | 2-4 px | 14-16 px; botones en píldora (`StadiumBorder`) |
| Fondo | `#f3f2f2` | `#f6f5f8` (leve tinte violeta) |
| Texto | `#201e1d` | `#201e1d` (igual); suave `#6b6878` |
| Extras | — | Tinta oscura `#1e1b3a` para login/splash; verde `#2e9d5b`; ondas decorativas; logo C en gradiente magenta con punto cian |

### Cómo se ve la app mobile en la práctica (pantallas ya implementadas)

Es lo único construido con diseño real en el repo (idéntico en `origin/main`, `origin/dev` y la rama de trabajo):

- **Login y splash**: fondo de tinta oscura `#1e1b3a`, logotipo + nombre "Cotizapp" en blanco, una ilustración de productos, titular "Compra mejor para tu negocio" (`headlineSmall` blanco, 700), bajada en blanco 70 %, y **ondas** decorativas (cian 35 %, magenta 55 %, rosa `#ff3d8b` 35 %) en el pie. Formulario centrado, `maxWidth: 420`, con tema oscuro propio.
- **Tarjeta de producto** (`producto_card.dart`): `Card` blanca, borde de 1 px divisor, radio 16, padding 12; miniatura de 72 px (radio 14), nombre en 700, "marca · formato" en gris suave, "desde **$precio**" (800), y chips en píldora (radio 20, 11.5 px, 600) con ícono: proveedores, plazo y, en destacado, "Ahorra hasta $X" en **verde** `#2e9d5b` sobre verde al 10 %.
- **Imagen sin foto**: ícono de la categoría raíz sobre un degradado suave de su color (10 % → 22 %). Colores por categoría: arroz `#b0752f`, huevos `#c99a00`, carnes `#e8613c`, verduras verde, bebidas cian, panadería `#9c5b2e`, limpieza `#6b5bd6`, otras magenta.
- **Estados comunes** (`estado_views.dart`): `CargandoView` (spinner centrado), `ErrorView` (ícono de error 40 px, mensaje y botón "Reintentar" outlined), `VacioView` (título + mensaje + acción opcional). Conviene replicarlos en el admin como componentes de "cargando / error / vacío".
- **Navegación**: `NavigationBar` blanca con indicador magenta al 12 %.

Ojo: aquí **sí aparecen verde y chips con íconos**, cosa que el mockup de desktop no usa. Son decisiones propias de la app mobile.

Para el admin-site se sigue el **mockup de desktop**, no el tema Flutter. Si en algún momento se quiere unificar la marca, el logo (cuadrado redondeado magenta con "C" blanca y punto cian, en `marca.dart`) es la pieza que ya existe.

## 10. Estado actual del admin-site (estilo mobile aplicado)

El admin-site adopta el lenguaje visual de **mobile** (no el del mockup desktop "Broadsheet"), manteniendo su función: tablas densas, filtros, paneles de detalle, confirmaciones y gráficos.

**Qué se tomó de mobile**
- Paleta `AppColors`: fondo `#f6f5f8`, superficie `#edebf2`, tinta `#1e1b3a` (solo login), magenta `#d6006c` como acción principal, cian `#0088b0` como apoyo/informativo, verde `#2e9d5b` para estados positivos.
- Radios: 14 px controles, 16 px tarjetas, píldora (999 px) en botones, badges y menú.
- Tipografía sans (Roboto → Segoe UI → system-ui), títulos en 700; ya no se usa Source Serif 4 ni el filete de 4 px.
- Marca: isotipo (cuadrado magenta + "C" blanca + punto cian) y ondas del login, como componentes `app-logo`, `app-marca` y `app-ondas` en `src/app/shared/ui/`.
- Login oscuro con ondas, inputs translúcidos en píldora y botón magenta; header blanco con marca, chip "Administración del sistema", avatar del usuario; menú lateral en píldoras con el activo en magenta al 12 %.

**Qué se conserva del propósito admin**
- Tablas con encabezado gris suave, filas compactas y tarjeta blanca contenedora; paneles de detalle laterales; filtros en línea; paginación; badges de estado (verde = positivo, magenta tenue = atención/pendiente, gris = neutro, cian = informativo); confirmaciones en tarjeta.
- Barras del dashboard en magenta; KPI en tarjetas.

**Tokens** (`src/styles.css`): `--color-bg/surface/card/text/text-soft/divider`, `--color-primary(-600/-100)`, `--color-accent*` (cian), `--color-accent-2*` (magenta tenue, errores), `--color-ok(-100/-800)`, `--tinta`, `--radius-md/lg/pill`, `--shadow-card`. Los nombres antiguos se conservaron para no romper los CSS por componente.

**Pendiente / decisiones**
1. Los CSS por feature siguen duplicando `.tabla`, `.badge`, `.mensaje`, `.panel`; conviene subirlos a `styles.css` o a componentes de `shared/ui` (vistas de cargando, error y vacío como en `estado_views.dart`).
2. Nombre visible unificado a **Cotizapp** en `brand.ts` (antes "CompraMejor").
3. Roboto no se carga desde la red; si se quiere idéntico a mobile en todos los equipos, autoalojar `@fontsource/roboto`.
4. Falta revisión visual en navegador pantalla por pantalla y pasar los tests (Karma no corre dentro del contenedor: no hay Chromium).

## 11. Fuentes consultadas

- `Fase1/Documentos Diseno/Mockups/CompraMejor Administrador.html` (principal), `Cliente.html`, `Proveedor.html`, `ClienteMovil.html`: CSS del sistema y estructura de pantallas. Los archivos están empaquetados (bundler de Claude Design); la plantilla y el CSS se leen decodificando `<script type="__bundler/template">`.
- `Proyecto/apps/mobile/lib/core/theme/app_theme.dart`, `lib/core/widgets/{marca,estado_views}.dart`, `features/auth/presentation/login_page.dart`, `features/catalogo/presentation/widgets/{producto_card,visual_categoria}.dart`.
- Revisión de `origin/main` (último commit `93b98b0`, 14-nov-2026): `apps/ecommerce` sigue siendo el andamio (`styles.css` de 1 línea, una sola pantalla `status`) y `apps/mobile` es idéntico a la copia de trabajo. `origin/dev` coincide con `main`.
- `Proyecto/apps/admin-site/src/styles.css`, `index.html` y `core/config/brand.ts` (estado actual).
- `Proyecto/apps/ecommerce/src/**` y las ramas `dev`, `main`, `dev-smy`, `dev-benjaycosas` (sin diseño).
