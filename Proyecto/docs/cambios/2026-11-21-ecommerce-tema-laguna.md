# Ecommerce con el tema Laguna del admin-site

- **Fecha:** 2026-11-21
- **Épica / ticket:** KAN-88 (plataforma), cambio solo visual

## Qué cambió

`apps/ecommerce` pasó de la paleta CMYK de los mockups (Source Serif 4, magenta
como acción, esquinas rectas) al tema **Laguna** de `apps/admin-site`: azul
marino, teal, menta y crema, tipografía Manrope, botones en píldora, tarjetas
redondeadas, y ondas y círculos decorativos.

- Variables globales con los mismos valores que el admin-site, conservando los
  nombres propios del ecommerce (`--color-accent`, `--color-accent-2`, ...) para
  no tocar los componentes. `--color-accent-2` pasó de magenta a salmón
  (errores/pendientes).
- Cabecera con franja marina e isotipo Laguna; pie marino con ondas; portada de
  inicio como panel marino con sol crema y ondas; panel de las pantallas de
  cuenta (ingresar, registro, recuperar) igual al login del admin-site.
- Chips, segmentos, etiquetas y estados en píldora; tarjetas, resumen del
  carro/checkout e imágenes con radio de 14 a 28 px.
- Precios y diferencias en teal (antes magenta); el efecto "offset" de los
  números pasó de cian/magenta/amarillo a teal/menta/crema.

## Por qué

Que ecommerce y admin-site se vean como un solo producto. Se priorizó CSS: el
HTML solo cambió en el isotipo de la cabecera y la fuente en `index.html`.

## Decisión

En el ecommerce `--color-accent` es `#138a80` (no `#1fa79d` como en el
admin-site) porque se usa como fondo de botones con texto blanco y como color
de enlaces; el teal claro no da contraste suficiente.

## Archivos

- `apps/ecommerce/src/index.html`, `src/styles.css`
- `apps/ecommerce/src/app/app.component.{html,css}`
- `apps/ecommerce/src/app/features/**/*.css` (inicio, cuenta, catálogo, producto,
  carro, checkout, pedidos, proveedor): radios, colores y estados
- `apps/ecommerce/README.md`, `docs/diseno/IDENTIDAD-VISUAL.md`

No se tocaron lógica, rutas, servicios ni clases usadas por los specs.
