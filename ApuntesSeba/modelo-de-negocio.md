# Modelo de negocio — Cotizapp

> Proyecto de Título (APT), Duoc UC, Ingeniería en Informática.
> Fuentes: presentación y guía de la Fase 1, README y `docs/ARCHITECTURE.md`, backlog de Jira (proyecto KAN) y mockups.
> Los puntos marcados **[Por definir]** no están decididos por el equipo y no se inventan aquí.

## 1. Qué es

Ecommerce centralizado de **cotización y compra multiproveedor** para pymes y emprendedores del rubro alimenticio en Chile. Permite comparar precio, plazo de entrega y calificación entre distribuidores, armar **un carrito con productos de varios distribuidores** y pagar **una sola vez**.

**Nombre:** **[Por definir]**. El código y los documentos académicos usan "Cotizapp"; los mockups y el backlog usan "CompraMejor". Mientras no se decida, este documento usa "Cotizapp".

## 2. El problema

| # | Problema | Detalle |
|---|---|---|
| 1 | Cotización dispersa | Las pymes cotizan por separado con cada distribuidor: llamadas, WhatsApp, visitas presenciales. |
| 2 | Sin comparación real | No existe un lugar donde comparar precio, tiempo de entrega y confiabilidad entre distribuidores. |
| 3 | Compra fragmentada | Comprar a varios distribuidores implica varios pagos y varios seguimientos por separado. |
| 4 | Poca visibilidad del distribuidor | Las distribuidoras pequeñas no tienen canales digitales para competir con los grandes actores. |

## 3. Propuesta de valor

- **Para el cliente (pyme / emprendedor):** compara en un solo lugar, ahorra tiempo de cotización, paga una vez y recibe un detalle de compra consolidado, aunque venga de varios proveedores.
- **Para el distribuidor:** un canal digital de venta, visibilidad frente a compradores, precios por volumen y estadísticas de venta que hoy no tiene.
- **Para la plataforma:** concentra la demanda y la oferta y controla la calidad (aprobación de proveedores, moderación de precios, auditoría).

## 4. Segmentos y actores

| Actor | Quién es | Qué hace en la plataforma |
|---|---|---|
| **Cliente / emprendedor** | Dueños de almacenes, minimarkets, restaurantes y emprendimientos gastronómicos que reabastecen cada semana. Ejemplo del equipo: "Juanito y su minimarket". | Explora el catálogo, compara distribuidores, arma un carrito multiproveedor, paga y sigue sus pedidos. |
| **Distribuidor / proveedor** | Distribuidoras pequeñas y medianas de abarrotes, insumos gastronómicos y productos envasados. | Publica ofertas con precios por volumen, gestiona cobertura, retiro y documentos, atiende órdenes de venta, ve liquidaciones, estadísticas y calificaciones. |
| **Administrador** | Equipo interno de la plataforma. | Aprueba y suspende proveedores, gestiona categorías y catálogo maestro, modera casos, supervisa órdenes, reembolsos, usuarios, roles y auditoría. |

## 5. Cómo funciona (flujo del cliente)

1. **Explora y compara:** busca abarrotes e insumos y compara precio, entrega y calificación entre distribuidores.
2. **Arma un carrito multiproveedor:** agrega productos de distintos distribuidores al mismo carrito.
3. **Paga una sola vez:** un único pago vía Webpay o MercadoPago.
4. **Recibe un detalle consolidado:** un comprobante único, aunque cada distribuidor emita su propio documento tributario.

Detrás del pago, la orden se **divide por proveedor** (split): cada distribuidor recibe su parte, con su propio envío y su propio documento tributario.

## 6. Reglas de negocio relevantes

- **Precio por volumen:** la oferta de un proveedor depende de la cantidad, no es un precio unitario fijo. Hay una oferta por producto y por proveedor.
- **Precio de referencia con tope:** si una oferta excede el tope sobre el precio de referencia, se abre un caso de moderación (`precio_fuera_rango`).
- **Historial:** cada cambio de precio o stock queda registrado.
- **Aprobación previa:** un proveedor opera solo después de que el administrador lo aprueba. Puede ser suspendido.
- **Cobertura y retiro:** el proveedor define dónde despacha y si ofrece retiro; el despacho se calcula por cobertura.
- **Documentos tributarios:** cada distribuidor emite el suyo. En el MVP se simulan (SII).
- **Calificaciones y entregas a tiempo:** alimentan la confianza del cliente en el distribuidor.
- **Seguridad de pago:** los datos de tarjeta nunca pasan por el backend propio; van directo a la pasarela.

## 7. Flujo del dinero

```
Cliente ──(un solo pago)──▶ Pasarela (Webpay / MercadoPago)
                                  │
                                  ▼
                       Orden dividida por proveedor
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        Proveedor A          Proveedor B          Proveedor C
   (bruto − comisión = neto, liquidado semanalmente)
```

- La pasarela **no hace split nativo**: el reparto entre distribuidores se **simula en la base de datos propia** (tabla `liquidacion`).
- Las liquidaciones son **semanales** y muestran período, bruto, comisión, neto, estado y fecha de pago.
- La **comisión se asigna por proveedor** al aprobarlo (la fija el administrador).
- El administrador ve el total transado, la comisión de la plataforma y el monto a liquidar a proveedores.
- Hay un flujo de **reembolsos** gestionado por el administrador.

## 8. Fuentes de ingreso

| Fuente | Estado |
|---|---|
| Comisión sobre ventas, por proveedor | El sistema la contempla (campo y liquidaciones), pero el porcentaje y la política **[Por definir]**. |
| Cobro mensual / suscripción al distribuidor | **[Por definir]**: el equipo aún no decide si habrá. |
| Publicidad o posicionamiento destacado | **[Por definir]**: el equipo aún no decide si habrá. |
| Otras (servicios a clientes, datos, financiamiento) | No consideradas. |

Mientras no se decida, el producto está preparado para la **comisión por proveedor**, que es lo que el backlog ya modela; los otros modelos no requieren cambios en el MVP.

## 9. Alcance del MVP

| Dimensión | Decisión |
|---|---|
| Rubro | Productos alimenticios (abarrotes e insumos), sin descartar otros nichos a futuro. |
| Pago | Pasarela real en sandbox (Webpay / MercadoPago), con split simulado en base propia. |
| Comprobante | Detalle consolidado para el cliente; cada distribuidor emite su documento tributario (simulado). |
| Logística | Sin logística propia; despacho y retiro los define cada proveedor. |
| Canales | Web para clientes y distribuidores, panel de administración aparte, y app móvil Flutter. |
| App móvil | Pensada para distribuidores: visitas, estadísticas de venta y calificaciones. El backlog también la plantea con perfil cliente. **[Por confirmar]** |

## 10. Viabilidad (según la Fase 1)

- **Técnica:** stack conocido por el equipo; arquitectura modular, no microservicios.
- **Económica:** recursos gratuitos o de bajo costo (sandbox de pagos, MySQL Community, un droplet de Digital Ocean de unos US$6-12 al mes, financiado por el equipo).
- **Operativa:** roles por afinidad; 18 semanas en 3 fases con Kanban.
- **Legal:** cada distribuidor emite su documento; los datos de tarjeta no tocan el backend.
- **De alcance:** MVP acotado a un rubro, con pago simulado y sin logística propia.
- **Riesgo principal:** la integración con la pasarela de pago, mitigado con sandbox desde la semana 9.

## 11. Pendientes del modelo de negocio

- [ ] Nombre definitivo (Cotizapp o CompraMejor).
- [ ] Modelo de ingresos: comisión (y su %), cobro mensual, publicidad, o combinación.
- [ ] Segmento de lanzamiento y zona geográfica inicial.
- [ ] Competencia y diferenciación (no documentadas).
- [ ] Perfiles de la app móvil: solo distribuidor o también cliente.
- [ ] Indicadores de éxito del negocio (los KPIs actuales del panel son operativos: órdenes, monto transado, comisión, proveedores activos).

## 12. Equipo

| Integrante | Rol |
|---|---|
| Samuel Alarcón Candia | Infraestructura |
| Sebastián Ramírez | DBA / Infraestructura |
| Benjamín González | Frontend / Backend |
