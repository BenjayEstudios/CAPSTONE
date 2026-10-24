# Reestructuración de la documentación

**Fecha:** 2026-10-23 · **Épica:** —

La documentación pasa de dos archivos que crecían sin fin
(`docs/ARCHITECTURE.md` y `docs/CHANGELOG.md`) a carpetas por tema, cada una
con su índice:

```
docs/
├── README.md        # índice maestro
├── arquitectura/    # ARQUITECTURA.md + MODELO-DE-DATOS.md
├── epicas/          # una por épica de Jira (KAN-85 a KAN-88) + tabla de estado
├── decisiones/      # abiertas y cerradas, con su motivo
├── diseno/          # identidad visual
├── cambios/         # esta bitácora, un archivo por cambio
├── desarrollo/      # cuentas de prueba, operación de la base
└── jira/            # export del backlog
```

- Cada entrada del CHANGELOG pasó a su propio archivo en `cambios/`. Las que
  mezclaban dos temas se partieron (Drizzle y CORS; CI, producción y compose
  sin root).
- Se agregaron las entradas que faltaban: inicialización con Fase 1,
  separación en `Fase1/`/`Proyecto/`, compose secuencial (llegó por `main`),
  KAN-140 (índices y particiones) y el paso único de CI con los tests de
  Angular.
- `ARCHITECTURE.md` se actualizó al partirlo: decía que mobile era "solo
  para distribuidores", y desde KAN-125 es para comprador y distribuidor.
- Las decisiones que estaban repartidas en el CHANGELOG, `infra/README.md` y
  las notas del DBML quedaron reunidas en `decisiones/`, con su motivo.
- Se usa "épica" y no "fase" porque el plan vive en las épicas de Jira y
  "Fase" ya es el nombre de las etapas del ramo.

La convención quedó escrita en `.claude/rules/documentation.md` (raíz del
repo), para que se siga aplicando en cada cambio.

**Por qué**: un solo archivo de cambios deja de servir cuando hay que
encontrar algo puntual, y la arquitectura mezclaba el estado actual con la
historia. Esto sirve también como contexto recuperable para conversaciones
futuras, sin depender del historial de git.

**Toca**: `docs/` completo (borra `ARCHITECTURE.md` y `CHANGELOG.md`),
`.claude/rules/documentation.md` (nuevo), `README.md` y
`apps/admin-site/README.md` (enlaces a la arquitectura).
