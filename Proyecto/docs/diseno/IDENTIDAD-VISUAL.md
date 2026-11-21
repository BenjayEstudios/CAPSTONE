# Identidad visual

## De dónde sale

Los mockups de Fase 1 (`Mockups/CompraMejor *.html`, cuando el producto aún
se llamaba "CompraMejor") comparten una paleta de estética **CMYK**: cian,
magenta y amarillo de proceso sobre fondos casi blancos, con texto casi
negro. Es la base de la identidad de Cotizapp: una herramienta para
comparar precios tiene que verse clara y ordenada, no de feria.

Los mockups son la referencia de **estructura y flujo** de cada pantalla. La
paleta se respeta; los detalles de forma (radios, botones, tarjetas) los
define cada app.

## Paleta

### Tokens de los mockups (web y mobile)

| Token | Color | Uso |
|---|---|---|
| `--color-text` | `#201E1D` | Texto principal |
| `--color-bg` | `#F3F2F2` | Fondo |
| `--color-surface` | `#EAE9E9` | Superficies (tarjetas, secciones) |
| `--color-accent` | `#0088B0` | Cian: enlaces, acento |
| `--color-process-yellow` | `#EDBB00` | Amarillo: destacados, insignias |
| magenta | `#D6006C` | Acciones (mockup móvil) |

### Implementación en mobile

`apps/mobile/lib/core/theme/app_theme.dart`, clase `AppColors`:

| Nombre | Color | Uso |
|---|---|---|
| `tinta` | `#1E1B3A` | Fondo de login y splash |
| `tintaClara` | `#2C2852` | Variación de la tinta |
| `fondo` | `#F6F5F8` | Fondo de pantallas internas |
| `superficie` | `#EDEBF2` | Contenedores |
| `texto` | `#201E1D` | Texto principal (igual al mockup) |
| `textoSuave` | `#6B6878` | Texto secundario, íconos inactivos |
| `magenta` | `#D6006C` | **Acción principal** (`primary`), pestaña activa |
| `acento` | `#0088B0` | Cian (`secondary`) |
| `amarillo` | `#EDBB00` | `tertiary`, insignias |
| `verde` | `#2E9D5B` | Estados positivos (ahorro, "Más bajo") |
| `divisor` | `#201E1D` al 12 % | Bordes y divisores |

La **tinta** oscura es propia de mobile: da un login y un splash con marca,
con ondas cian/magenta y el logo. Fondo y superficie se corrieron un poco
hacia el violeta para que combinen con la tinta.

## Formas (mobile)

Material 3. Tarjetas blancas sin elevación, con borde `divisor` y radio 16;
inputs con relleno blanco y radio 14; botones en píldora (52 px de alto el
principal); chips en píldora; barra inferior blanca con indicador magenta al
12 %. Títulos en peso 700, subtítulos 600.

## Tipografía

Los mockups usan **Source Serif 4**; la web (ecommerce y admin-site) usa Manrope. Mobile usa por
ahora la tipografía del sistema (Roboto en Android). Si se quiere alinear,
empaquetar los `.ttf` en `assets/fonts/` y declararlos en `pubspec.yaml`,
sin `google_fonts`, para que funcione offline.

## Web: tema Laguna (ecommerce y admin-site)

`apps/ecommerce` y `apps/admin-site` comparten el tema **Laguna**: azul marino
profundo, teal, menta muy claro y acentos crema, con ondas y círculos
decorativos, y tipografía **Manrope** (400 a 800). La fuente de verdad es
`apps/admin-site/src/styles.css`; el ecommerce copia los mismos valores en
`apps/ecommerce/src/styles.css`. Esto reemplaza la paleta CMYK de los mockups
en la web (los mockups siguen siendo la referencia de estructura y flujo).

| Token | Valor | Uso |
|---|---|---|
| `--tinta` / `--tinta-clara` | `#0b3d5c` / `#134e72` | Texto, paneles y pie marinos |
| `--color-bg` / `--color-surface` / `--color-card` | `#eef6f5` / `#d9eae7` / `#fafdfd` | Fondo, superficies, tarjetas |
| `--color-primary` | `#138a80` | Acción principal, enlaces |
| `--color-menta` / `--color-crema` | `#99e6da` / `#f3e2c7` | Acentos sobre marino (sol, ondas) |
| `--color-accent-2` | `#c8483a` | Salmón: errores y pendientes (antes magenta) |
| `--color-ok` | `#1f9d6b` | Estados positivos |

Formas: botones y chips en píldora, controles con radio 14, tarjetas con radio
20 (paneles de login y portada, 28), sombra suave `--shadow-card`.

Diferencia deliberada: en el ecommerce `--color-accent` vale `#138a80` (igual
que primary) y no `#1fa79d`, porque se usa como fondo de botones con texto
blanco y el teal claro no da contraste. Las ondas del ecommerce son una
imagen SVG en la variable `--ondas-laguna` (`styles.css`), usada en el pie, la
portada y el panel de las pantallas de cuenta; el isotipo es el mismo SVG del
admin-site, en línea en `app.component.html`.

## Marca en Android

Ícono adaptativo y splash nativo con la marca, sin el logo de Flutter ni el
destello blanco al abrir (`android/app/src/main/res/`).
