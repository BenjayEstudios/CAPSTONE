# CAPSTONE — Cotizapp

Repositorio del Proyecto de Título (APT) de Duoc UC, Ingeniería en Informática.

**Cotizapp** es un ecommerce centralizado de cotización y compra multiproveedor
para pymes/emprendedores del rubro alimenticio: permite comparar precio,
tiempo de entrega y calificación entre distribuidores, armar un carrito
multiproveedor y pagar todo en una sola transacción.

## Estructura del repositorio

```
CAPSTONE/
├── Fase1/      # Entregables y evidencias de la Fase 1 del ramo (no modificar)
└── Proyecto/   # Código fuente del proyecto (monorepo Cotizapp)
```

Todo el detalle técnico (stack, cómo levantar el entorno, arquitectura,
modelo de datos, etc.) está en [Proyecto/README.md](Proyecto/README.md).

## Equipo

- **Samuel Alarcón Candia** — Infraestructura
- **Sebastián Ramírez** — DBA / Infraestructura
- **Benjamín González** — Frontend / Backend

## Flujo de trabajo con ramas

Este repo no usa una rama `prod` separada por tema de costos: **`dev` cumple
el rol de ambiente productivo** (es la rama con el código final desplegado).

Ramas de desarrollo, una por integrante:

- `dev-benjaycosas`
- `dev-sebamax`
- `dev-smy`

### Cómo se integra el código

1. Cada integrante desarrolla y hace commits en **su propia rama**
   (`dev-benjaycosas`, `dev-sebamax` o `dev-smy`) y la pushea normalmente.
2. Cuando los cambios están listos, se abre un **Pull Request desde esa rama
   hacia `main`**.
3. En `main` se integra el código de todo el equipo: se resuelven los
   merges/conflictos y se revisa el PR ahí.
4. Una vez que el PR hacia `main` está **aprobado y mergeado**, recién ahí se
   abre un **Pull Request desde `main` hacia `dev`**, para llevar a
   producción lo que ya quedó validado en `main`.

```
dev-benjaycosas ─┐
dev-sebamax      ─┼── PR ──▶ main ── PR ──▶ dev (= producción)
dev-smy          ─┘
```

**Regla general: nunca se pushea directo a `main` ni a `dev`.** Todo cambio
entra siempre mediante Pull Request.

## Fase1

La carpeta `Fase1/` contiene los entregables y evidencias de la primera fase
del proyecto (documentos de diseño, casos de uso, mockups, minutas y
evidencias individuales/grupales). No debe modificarse.
