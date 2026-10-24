# Jira

[`backlog-cotizapp.csv`](backlog-cotizapp.csv) es el export del backlog con
el que se cargó Jira: 4 épicas y 81 historias/tareas, con descripción,
criterios de aceptación, prioridad, responsable y etiquetas.

Es una **fuente**, no un documento vivo: el estado de cada ticket se lleva en
Jira y se resume en [../epicas/](../epicas/README.md). No se edita a mano.

Los IDs del CSV no son los de Jira:

| CSV | Jira |
|---|---|
| `E1` Ecommerce web | KAN-85 |
| `E2` Página administradora | KAN-86 |
| `E3` App mobile | KAN-87 |
| `E4` Plataforma | KAN-88 |
| `S001` … `S081` | `S` + 88 → KAN-89 … KAN-169 |

Algunas descripciones del CSV mencionan `docs/ARCHITECTURE.md`; desde la
[reestructuración de la documentación](../cambios/2026-10-23-reestructuracion-de-documentacion.md)
eso es [`docs/arquitectura/`](../arquitectura/README.md).
