# Documentación del proyecto

Todo cambio relevante se documenta **en el mismo cambio que lo introduce**,
no después. La documentación vive en `Proyecto/docs/`.

## Estructura de `Proyecto/docs/`

La documentación vive **en carpetas por tema**, nunca en archivos monolíticos
que crecen sin fin. Estructura vigente:

```
Proyecto/docs/
├── README.md          # índice maestro
├── arquitectura/      # el patrón: capas, dependencias, modelo de datos
├── epicas/            # un archivo por épica de Jira + tabla de estado
├── decisiones/        # decisiones que cruzan épicas, abiertas y cerradas
├── diseno/            # identidad visual y criterios de diseño
├── cambios/           # bitácora cronológica, un archivo por cambio
├── desarrollo/        # cuentas de prueba, operación de la base, lo que no está en el código
└── jira/              # export del backlog (fuente, no se edita a mano)
```

**Reglas:**

- Cada carpeta tiene su `README.md` índice. Si agregas un archivo, agrégalo al
  índice en el mismo cambio.
- Si un documento pasa de ~200 líneas o mezcla dos temas, se parte en archivos
  dentro de su carpeta. No se deja crecer.
- Una carpeta nueva solo se crea cuando hay un tema que no calza en las
  existentes, y nace con su `README.md`.

## Nombres de archivo

Tienen que ser reconocibles sin abrirlos:

| Tipo | Patrón | Ejemplo |
|---|---|---|
| Épica | `EPICA-KAN-NN-tema-corto.md` | `EPICA-KAN-87-app-mobile.md` |
| Cambio | `AAAA-MM-DD-tema-corto.md` | `2026-10-23-mobile-login-y-navegacion-por-perfil.md` |
| Referencia | `NOMBRE-DESCRIPTIVO.md` | `IDENTIDAD-VISUAL.md`, `DECISIONES-ABIERTAS.md` |
| Índice | `README.md` | — |

Carpetas en minúsculas, sin tildes ni espacios. Nada de `doc1.md`, `notas.md`
ni `temp.md`.

Se usa "épica" y no "fase" porque el plan del proyecto vive en las épicas de
Jira (KAN-85 a KAN-88), y "Fase" ya es el nombre de las etapas del ramo
(`Fase1/`).

## Qué va en cada lugar

- **`arquitectura/`** — cómo son las cosas hoy: capas, reglas de dependencia,
  patrones transversales, modelo de datos.
- **`cambios/`** — cómo llegaron a serlo: un archivo por cambio relevante
  (feature nuevo, decisión de arquitectura, refactor grande, corrección con
  contexto), con fecha, épica/ticket, qué cambió, **por qué**, y qué archivos
  toca. Los cambios de API se anotan acá.
- **`epicas/`** — qué falta y en qué orden, con el estado de cada ticket.
- **`decisiones/`** — lo ya resuelto con su motivo, para no re-litigarlo, y lo
  pendiente con la épica en que aplica.
- **`diseno/`** — identidad visual y criterios de diseño.
- **`desarrollo/`** — lo que hace falta para trabajar y no se deduce del
  código.

Arquitectura y cambios no se mezclan: la primera describe el estado, la segunda
la historia. Las entradas antiguas de `cambios/` no se reescriben cuando algo
cambia después: describen lo que era cierto en su fecha.

Esto sirve como **contexto recuperable para conversaciones futuras**: no
asumas que el historial de git o la memoria de una sesión anterior están
disponibles.

## READMEs de código

- Cada directorio bajo `apps/` y cada paquete bajo `packages/` debe tener su
  propio `README.md`: qué hace, su estructura interna, cómo correrlo y
  testearlo, y las decisiones de arquitectura propias de esa carpeta.
- Si se crea un directorio nuevo bajo `apps/` o `packages/`, su `README.md` se
  crea en el mismo cambio que lo introduce.

## Al cerrar un ticket o una épica

Actualizar el estado del ticket en su archivo de `docs/epicas/` y la tabla de
`docs/epicas/README.md`, agregar la entrada en `docs/cambios/` (y en su
índice), mover a `docs/decisiones/` lo que se haya resuelto, y actualizar
`docs/arquitectura/` si cambió cómo son las cosas.
