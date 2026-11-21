# CI: fallos intermitentes por la caché de Turborepo

**Fecha:** 2026-11-20 · **Épica:** — · **Ticket:** — (corrección del CI)

## Qué pasó

Las corridas #53 (KAN-106) y #55 (KAN-108) del workflow CI en
`dev-benjaycosas` fallaron, y las siguientes pasaron con el mismo código. En
las dos, `packages/application` usó código de `@cotizapp/domain` que existía
pero llegó incompleto:

- #53: `TypeError: Cannot read properties of undefined (reading 'safeParse')`
  en los esquemas de moderación, al correr los tests de application.
- #55: `'"@cotizapp/domain"' has no exported member named 'ProductoRepository'`,
  al compilar application.

Ninguno de esos commits tocaba esos archivos.

## Causa

1. El CI restaura la caché de Turborepo (`Proyecto/.turbo/cache`) y corre
   `turbo run check-types lint test build`. Si `domain#build` es un acierto de
   caché, Turbo restaura `dist/**`, que era lo único declarado en `outputs`.
2. `tsconfig.tsbuildinfo` no estaba en `outputs` y no se versiona, así que
   tras un acierto de caché no existe.
3. `application`, `infrastructure` y `apps/backend` compilan con `tsc -b` y
   tienen `references` a `domain`. Sin el `tsbuildinfo`, `tsc -b` considera a
   `domain` desactualizado y lo vuelve a compilar: reescribe
   `packages/domain/dist` mientras otras tareas en paralelo, como los tests de
   application, lo están leyendo.

Se reprodujo en local: sin `packages/domain/tsconfig.tsbuildinfo`,
`tsc -b --dry --verbose` en application dice que compilaría domain ("output
file '../domain/tsconfig.tsbuildinfo' does not exist").

## Qué cambió

`turbo.json`: la tarea `build` declara `"outputs": ["dist/**",
"*.tsbuildinfo"]`. Con un acierto de caché se restaura también el
`tsbuildinfo`, y `tsc -b` ve a `domain` al día y no lo recompila.

Comprobado en local:

1. `turbo run build --filter=@cotizapp/domain` (fallo de caché) guarda las dos cosas.
2. Se borró el `tsbuildinfo` y se volvió a correr: acierto de caché, y el archivo se restauró.
3. `tsc -b --dry --verbose` en application dice "Project '../domain/tsconfig.json' is up to date".

`turbo run build check-types lint` pasa entero: 14 de 14 tareas.

## Por qué así

- Es el cambio más chico que cierra la causa: los paquetes siguen con
  `tsc -b`, y el modo `dev` (`tsc -b --watch`) no cambia.
- La alternativa, compilar cada paquete con `tsc -p` sin referencias, también
  evita la carrera. Pero cambia cómo se construye cada paquete y el orden
  pasaría a depender solo de Turbo; no hace falta mientras el `tsbuildinfo`
  viaje con la caché.

## Archivos

- `turbo.json`
