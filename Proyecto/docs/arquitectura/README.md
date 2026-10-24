# Arquitectura

Cómo son las cosas hoy. La historia de cómo llegaron a serlo vive en
[../cambios/](../cambios/README.md).

| Archivo | Qué contiene |
|---|---|
| [ARQUITECTURA.md](ARQUITECTURA.md) | Monorepo, capas y regla de dependencia, cada app (backend, ecommerce, admin-site, mobile), pagos e infraestructura. |
| [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md) | Base MySQL: tablas, migraciones, índices y restricciones especiales, particiones, calificaciones y tests de repositorios. |

El modelo entidad-relación completo (DBML) es
[`DataBase/dbDiagram.sql`](../../DataBase/dbDiagram.sql); las notas de cada
tabla explican sus decisiones.
