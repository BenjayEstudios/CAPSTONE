# Integración del rediseño "Laguna" en el admin-site

**Fecha:** 2026-11-21 · **Épica:** KAN-86 · **Ticket:** —

## Qué cambió

Se integró el rediseño visual "Laguna" de la rama `dev-sebamax` en el
admin-site: panel azul marino con ondas y sol crema, tarjeta clara y los
componentes compartidos `MarcaComponent` y `OndasComponent`.

La rama de Sebastián es anterior al 2FA con app autenticadora (TOTP, KAN-144),
así que el login no se tomó de un solo lado:

| Archivo | De dónde viene |
|---|---|
| `login.component.ts` | La versión de `main` (2FA TOTP con primer enrolamiento por QR, `formMfa`, `secretoAgrupado`) más los imports de `MarcaComponent` y `OndasComponent` que usa el template nuevo |
| `login.component.html` | El layout Laguna, con el bloque de enrolamiento de `main` (instrucciones, QR y clave manual) reinsertado dentro de la tarjeta. El paso 2 usa `[formGroup]="formMfa"` |
| `login.component.css` | El CSS Laguna más estilos nuevos para `.enrolamiento`, `.instrucciones`, `.qr`, `.secreto-ayuda` y `.secreto`, con los tokens del tema |

Los textos del login ya no hablan de un "código enviado a tu correo": el título
y el subtítulo cambian según el paso (ingresar, activar la verificación o
verificar) y el botón dice "Activar y entrar" durante el enrolamiento.

También se corrigieron dos errores de lint de accesibilidad en
`organizacion-selector.component.html`: las opciones del combobox tenían
`(click)` sin evento de teclado y no eran enfocables.

## Por qué así

- **No se portaron el "Reenviar código" ni el enfriamiento de 30 s.** En la
  rama de Sebastián el código llegaba por correo y `reenviar()` llamaba a
  `POST /auth/admin/mfa/reenviar`. Producción usa TOTP: el código lo genera la
  app y no hay nada que reenviar. Esa ruta ya no existe (el backend tiene un
  test que exige que responda 404, en `routes/auth/mfa.test.ts`) y
  `AuthService` no tiene `reenviarMfa()`.
- **`[formGroup]="formMfa"` en el paso 2.** El template de Laguna usaba
  `[formControl]` sobre un `<form>` sin directiva. Así `(ngSubmit)` nunca se
  emite y el navegador hace un submit nativo que recarga la página: es el bug
  que `main` ya había corregido y que cubre un test de `LoginComponent`.
- **El QR va sobre blanco** en ambos temas, porque los lectores necesitan
  contraste oscuro sobre claro.
- **Opciones del combobox con `tabindex="-1"` y no `0`.** El selector sigue el
  patrón combobox de ARIA 1.2: el foco se queda en el input y la opción activa
  se marca con `aria-activedescendant`. Si las opciones entraran al orden de
  Tab, se rompería ese patrón. `tabindex="-1"` las hace enfocables solo por
  código y `(keydown.enter)` cubre el caso en que una de ellas tenga el foco.

## Archivos

- `apps/admin-site/src/app/features/login/login.component.{ts,html,css}`
- `apps/admin-site/src/app/features/usuarios/organizacion-selector.component.html`
