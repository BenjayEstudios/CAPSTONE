# Repo separado en `Fase1/` y `Proyecto/`, con flujo de ramas

**Fecha:** 2026-09-22 · **Épica:** —

El código del monorepo se movió a `Proyecto/`, sin tocar `Fase1/`, y se
agregó un `README.md` en la raíz que describe el proyecto, el equipo y el
flujo de trabajo con ramas:

```
dev-benjaycosas ─┐
dev-sebamax      ─┼── PR ──▶ main ── PR ──▶ dev (= producción)
dev-smy          ─┘
```

- Una rama de desarrollo por integrante.
- PR de la rama personal a `main`; recién con eso aprobado y mergeado, PR de
  `main` a `dev`.
- **Nunca se pushea directo a `main` ni a `dev`.**

**Por qué**: no hay rama `prod` separada por costos; `dev` cumple ese rol
(es lo desplegado). Separar `Fase1/` evita que el código toque los
entregables ya evaluados.

**Toca**: `README.md` (raíz, nuevo), todo `Proyecto/` (movido).
