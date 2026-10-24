# Consultas de analítica y sus planes de ejecución (KAN-143)

Las consultas de los paneles viven en
`src/repositories/analitica.repository.ts` (`DrizzleAnaliticaRepository`,
puerto `AnaliticaRepository` en `@cotizapp/domain`). Están escritas en SQL a
mano para que lo que se ejecuta sea exactamente lo que se revisó aquí: **si
cambias una consulta, vuelve a mirar su plan**.

| Función | Panel | Qué devuelve |
|---|---|---|
| `ventasPorSemana(proveedorId, rango)` | proveedor | envíos, ventas, despacho, comisión y neto por semana (lun-dom); semanas sin ventas en 0 |
| `ventasPorProducto(proveedorId, rango, limite)` | proveedor | unidades y monto por producto, de mayor a menor |
| `embudoPorProducto(proveedorId, rango)` | proveedor | vistas de la ficha → clicks en su oferta → conversiones, con tasas |
| `kpisPlataforma(rango)` | admin | órdenes, GMV, ticket promedio, comisiones, proveedores y clientes activos, vistas/clicks/conversión, búsquedas y búsquedas sin resultados |
| `terminosSinResultados(rango, limite)` | admin | lo que más se busca y no existe en el catálogo |

## Convenciones

- **Rango `[desde, hasta)`** en UTC, que es como Drizzle guarda los
  `datetime`. Las semanas son lunes-domingo en UTC. El repositorio pasa las
  fechas a SQL como texto UTC: un `Date` pasado directo a `` sql`...` `` lo
  formatea mysql2 en hora local (en Chile, 3-4 h corrido). Lo cubre un test.
- **Qué es una venta**: un `orden_envio` no cancelado de una orden con
  `estado_pago = 'pagado'`, fechado por `orden.creada_en`.
- **Embudo**: las vistas son de la ficha del producto (compartida entre
  proveedores) y los clicks/conversiones, de la oferta de ESE proveedor.

## Cómo se revisaron los planes

El seed tiene 11 órdenes y ~2.000 eventos: con eso el optimizador prefiere
recorrer tablas enteras y los planes no dicen nada. Por eso se midió sobre un
schema desechable con volumen (`docs/volumen.sql`: ~40 mil órdenes, 80 mil
envíos entre 30 proveedores, 240 mil líneas y 800 mil eventos durante 2026),
con `EXPLAIN ANALYZE`, MySQL 8.4, un proveedor y un rango de 3 meses
(agosto-octubre). Los tiempos son de un portátil con la caché caliente:
sirven para comparar, no como promesa.

A partir de eso la migración `0005_indices_analitica.sql` cambió cuatro
índices por compuestos (mismos nombres):

| Índice | Antes | Después |
|---|---|---|
| `ix_evento_analitico_producto_id` | `(producto_id)` | `(producto_id, tipo_evento, creado_en)` |
| `ix_evento_analitico_oferta_id` | `(oferta_id)` | `(oferta_id, creado_en, convirtio)` |
| `ix_evento_analitico_tipo_evento` | `(tipo_evento)` | `(tipo_evento, creado_en)` |
| `ix_orden_estado_pago` | `(estado_pago)` | `(estado_pago, creada_en)` |

`oferta_id` solo se llena en `click_oferta`, así que su índice no necesita
`tipo_evento`. Como la PK de `evento_analitico` es `(id, creado_en)`, todo
índice secundario ya arrastra `creado_en` al final; pero sin ponerlo
explícito antes, MySQL no puede usarlo como rango.

## Planes

### `ventasPorSemana` y `ventasPorProducto`

```
-> Nested loop inner join                                   (8 ms / 13 ms)
    -> Index lookup on oe using ix_orden_envio_proveedor_estado (proveedor_id=?),
       with index condition: (oe.estado <> 'cancelado')            rows=2667
    -> Single-row index lookup on o using PRIMARY (id=oe.orden_id)
       + filtro estado_pago y creada_en                      rows=0.3 por envío
  [ventasPorProducto además:]
    -> Index lookup on l using orden_linea_orden_envio_id_..._fk   rows=3 por envío
    -> Single-row index lookup on p using PRIMARY
```

Entra por el proveedor (`ix_orden_envio_proveedor_estado`) y busca cada
orden por PK. Lee **todo el historial** del proveedor (2.667 envíos) para
quedarse con los del rango (803). No se cambió nada: con decenas de
proveedores la condición del proveedor es la más selectiva y la consulta
tarda 8-13 ms. Si un proveedor llegara a cientos de miles de envíos, la
mejora sería tener la fecha en `orden_envio` (p. ej. un índice
`(proveedor_id, creada_en)` con la fecha de la orden copiada); hoy no se
justifica.

### `embudoPorProducto`

Una subconsulta correlacionada por métrica y por oferta del proveedor (17
ofertas en la prueba).

| Subconsulta | Antes (por oferta) | Después (por oferta) |
|---|---|---|
| vistas | 21 ms: `Index lookup ... ix_..._producto_id (producto_id)`, lee la fila para filtrar `tipo_evento` (12 mil filas) | 2,9 ms: `Covering index lookup ... ix_..._producto_id (producto_id, tipo_evento)` |
| clicks | `Covering index lookup ... (oferta_id)` | igual, con el índice nuevo |
| conversiones | `Index lookup` + lectura de fila para `convirtio` | `Covering index lookup` (convirtio está en el índice) |

Total: **~360 ms → ~50 ms**. "Covering" significa que el `COUNT` se
responde solo con el índice, sin leer la fila.

### `kpisPlataforma`

Ventas (`orden`):

```
rango de 3 meses:  Table scan on o                     (12 ms; 29% de las filas)
rango de 1 semana: Index range scan on o using ix_orden_estado_pago
                   over (estado_pago = 'pagado' AND desde <= creada_en < hasta)   (2,4 ms)
```

Antes el índice era solo `(estado_pago)`: recorría todas las órdenes
pagadas de la historia (38 mil) para filtrar la fecha (38-47 ms). Con el
compuesto, en rangos cortos (lo normal en el panel: semana o mes) es un rango
exacto; en rangos que tocan un tercio de la tabla, MySQL elige bien recorrerla
entera.

Eventos (`evento_analitico`): cuenta todos los eventos del rango, así que
hay que leerlos todos. El plan es `Table scan`, pero **solo sobre las
particiones del rango** (229 mil filas de 802 mil; ~66 ms para 3 meses). Un
índice no ayudaría.

### `terminosSinResultados`

```
antes:   Index lookup using ix_..._tipo_evento (tipo_evento='busqueda'),
         with index condition creado_en           -> todas las búsquedas de la historia
después: Index range scan using ix_..._tipo_evento
         over (tipo_evento = 'busqueda' AND desde <= creado_en < hasta)
```

Mismo tiempo en la prueba (~30 ms, dominado por leer `resultados` de cada
fila), pero ahora el costo depende del rango y no del historial completo.

## Lo que queda cubierto por tests

`test/analitica.repository.test.ts` verifica los montos contra las órdenes
del seed calculadas a mano, el embudo y los KPIs contra conteos directos, la
comparación en UTC y, con `EXPLAIN` sobre el seed, que las subconsultas del
embudo y la de términos usen los índices compuestos y poden particiones.
`test/restricciones.test.ts` cubre el FULLTEXT, el CHECK, las particiones y
`ix_oferta_comparador` (KAN-140).
