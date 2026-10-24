# Épicas — Cotizapp

El plan del proyecto vive en Jira, en cuatro épicas. Un archivo por épica,
con su alcance, el estado de cada ticket y lo pendiente.

Se llaman épicas y no fases porque así está armado el backlog, y porque
"Fase" ya es el nombre de las etapas del ramo (`Fase1/`).

Al cerrar un ticket: actualizar su fila en el archivo de la épica y, si
cambia el resumen, esta tabla. La entrada de qué se hizo va en
[../cambios/](../cambios/README.md).

## Estado general

| Épica | Contenido | Responsable | Estado |
|---|---|---|---|
| [KAN-85](EPICA-KAN-85-ecommerce-web.md) | Ecommerce web: sitio de compra del cliente y panel web del proveedor | Benjamín González | ⏳ Pendiente (solo la vista de status) |
| [KAN-86](EPICA-KAN-86-admin-site.md) | Página administradora | Sebastián Ramírez | ⏳ Pendiente (scaffold con lint y tests) |
| [KAN-87](EPICA-KAN-87-app-mobile.md) | App mobile para comprador y distribuidor | Samuel Alarcón | 🔄 Base, login y catálogo listos con fakes; faltan carro, pedidos y distribuidor |
| [KAN-88](EPICA-KAN-88-plataforma.md) | Plataforma: BD, API, infraestructura, pagos, QA | Equipo | 🔄 BD casi completa e infra servible; API sin empezar |

Leyenda: ✅ listo · 🔄 en curso o parcial · ⏳ pendiente.

## Numeración

El export del backlog ([../jira/](../jira/README.md)) usa IDs propios
(`E1`…`E4`, `S001`…`S081`). En Jira las épicas son KAN-85 a KAN-88 y cada
historia es **`S` + 88**: `S037` → KAN-125, `S070` → KAN-158, `S081` →
KAN-169.

Las decisiones que cruzan varias épicas viven en
[../decisiones/](../decisiones/README.md), no acá.
