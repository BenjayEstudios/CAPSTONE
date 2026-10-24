import { sql } from "drizzle-orm";
import type {
  AnaliticaRepository,
  EmbudoProducto,
  KpisPlataforma,
  RangoFechas,
  TerminoSinResultados,
  VentaProducto,
  VentaSemanal
} from "@cotizapp/domain";
import { consultar, type DbClient } from "../db/client.js";

// MySQL devuelve SUM() como DECIMAL (string en mysql2) y NULL si no hay filas.
const n = (v: unknown): number => Number(v ?? 0);
const tasa = (parte: number, total: number): number | null => (total === 0 ? null : Math.round((parte / total) * 10000) / 10000);

const DIA = 24 * 60 * 60 * 1000;

// Drizzle guarda los datetime en UTC, pero un Date pasado como parametro en
// sql`` lo formatea mysql2 en hora local: se pasa ya como texto UTC.
const utc = (d: Date): string => d.toISOString().slice(0, 19).replace("T", " ");

// Lunes 00:00 UTC de la semana de una fecha (misma regla que el SQL:
// DATE(x) - WEEKDAY(x), con los datetime guardados en UTC).
function lunesUtc(fecha: Date): Date {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA);
}

// Que cuenta como venta: envio no cancelado de una orden pagada, fechado
// por orden.creada_en. Compartido por las consultas del panel proveedor.
const ventaDelProveedor = (proveedorId: number, rango: RangoFechas) => sql`
  oe.proveedor_id = ${proveedorId}
  AND oe.estado <> 'cancelado'
  AND o.estado_pago = 'pagado'
  AND o.creada_en >= ${utc(rango.desde)} AND o.creada_en < ${utc(rango.hasta)}`;

// Consultas de los paneles (KAN-143). SQL escrito a mano para que coincida
// con lo revisado con EXPLAIN en docs/CONSULTAS_ANALITICA.md; si se cambia
// una consulta, volver a revisar su plan.
export class DrizzleAnaliticaRepository implements AnaliticaRepository {
  constructor(private readonly db: DbClient) {}

  // Plan: ix_orden_envio_proveedor_estado -> orden por PRIMARY.
  async ventasPorSemana(proveedorId: number, rango: RangoFechas): Promise<VentaSemanal[]> {
    const filas = await consultar<{ semana: string; envios: number; ventas: string; despacho: string; comision: string }>(
      this.db,
      sql`
        SELECT DATE_FORMAT(DATE(o.creada_en) - INTERVAL WEEKDAY(o.creada_en) DAY, '%Y-%m-%d') AS semana,
               COUNT(*) AS envios,
               SUM(oe.subtotal) AS ventas,
               SUM(COALESCE(oe.costo_despacho, 0)) AS despacho,
               SUM(oe.comision_monto) AS comision
        FROM orden_envio oe
        JOIN orden o ON o.id = oe.orden_id
        WHERE ${ventaDelProveedor(proveedorId, rango)}
        GROUP BY semana`
    );
    const porSemana = new Map(filas.map((f) => [f.semana, f]));

    // Una fila por semana del rango, con ceros donde no hubo ventas.
    const semanas: VentaSemanal[] = [];
    for (let lunes = lunesUtc(rango.desde); lunes < rango.hasta; lunes = new Date(lunes.getTime() + 7 * DIA)) {
      const semana = lunes.toISOString().slice(0, 10);
      const f = porSemana.get(semana);
      const ventas = n(f?.ventas);
      const despacho = n(f?.despacho);
      const comision = n(f?.comision);
      semanas.push({ semana, envios: n(f?.envios), ventas, despacho, comision, neto: ventas + despacho - comision });
    }
    return semanas;
  }

  // Plan: ix_orden_envio_proveedor_estado -> orden por PRIMARY -> orden_linea
  // por su FK (orden_envio_id) -> producto por PRIMARY.
  async ventasPorProducto(proveedorId: number, rango: RangoFechas, limite = 10): Promise<VentaProducto[]> {
    const filas = await consultar<{ productoId: number; nombre: string; unidades: string; ventas: string }>(
      this.db,
      sql`
        SELECT l.producto_id AS productoId, p.nombre, SUM(l.cantidad) AS unidades, SUM(l.total_linea) AS ventas
        FROM orden_envio oe
        JOIN orden o ON o.id = oe.orden_id
        JOIN orden_linea l ON l.orden_envio_id = oe.id
        JOIN producto p ON p.id = l.producto_id
        WHERE ${ventaDelProveedor(proveedorId, rango)}
        GROUP BY l.producto_id, p.nombre
        ORDER BY ventas DESC, l.producto_id
        LIMIT ${limite}`
    );
    return filas.map((f) => ({ productoId: f.productoId, nombre: f.nombre, unidades: n(f.unidades), ventas: n(f.ventas) }));
  }

  // Una fila por oferta del proveedor (cualquier estado: una pausada pudo
  // tener clicks). Subconsultas correlacionadas porque el proveedor tiene
  // pocas ofertas y cada una se resuelve solo con el indice compuesto:
  // vistas con ix_evento_analitico_producto_id (producto_id, tipo_evento,
  // creado_en), clicks/conversiones con ix_evento_analitico_oferta_id
  // (oferta_id, creado_en, convirtio). El rango de fechas poda particiones.
  async embudoPorProducto(proveedorId: number, rango: RangoFechas): Promise<EmbudoProducto[]> {
    const filas = await consultar<{ productoId: number; nombre: string; vistas: number; clicks: number; conversiones: number }>(
      this.db,
      sql`
        SELECT f.producto_id AS productoId, p.nombre,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.producto_id = f.producto_id AND e.tipo_evento = 'vista_producto'
              AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS vistas,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.oferta_id = f.id AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS clicks,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.oferta_id = f.id AND e.convirtio = 1
              AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS conversiones
        FROM oferta f
        JOIN producto p ON p.id = f.producto_id
        WHERE f.proveedor_id = ${proveedorId}
        ORDER BY f.producto_id`
    );
    return filas.map((f) => ({
      productoId: f.productoId,
      nombre: f.nombre,
      vistas: n(f.vistas),
      clicks: n(f.clicks),
      conversiones: n(f.conversiones),
      tasaClick: tasa(n(f.clicks), n(f.vistas)),
      tasaConversion: tasa(n(f.conversiones), n(f.clicks))
    }));
  }

  // Dos consultas: ventas (ix_orden_estado_pago (estado_pago, creada_en))
  // y eventos (recorre solo las particiones del rango, que es lo que hay que
  // leer para contar todo).
  async kpisPlataforma(rango: RangoFechas): Promise<KpisPlataforma> {
    const [ventas] = await consultar<{ ordenes: number; gmv: string; comisiones: string; clientes: number; proveedores: number }>(
      this.db,
      sql`
        SELECT COUNT(*) AS ordenes,
               SUM(o.total) AS gmv,
               SUM(o.comision_total) AS comisiones,
               COUNT(DISTINCT o.organizacion_id) AS clientes,
               (SELECT COUNT(DISTINCT oe.proveedor_id)
                  FROM orden_envio oe JOIN orden o2 ON o2.id = oe.orden_id
                 WHERE oe.estado <> 'cancelado' AND o2.estado_pago = 'pagado'
                   AND o2.creada_en >= ${utc(rango.desde)} AND o2.creada_en < ${utc(rango.hasta)}) AS proveedores
        FROM orden o
        WHERE o.estado_pago = 'pagado' AND o.creada_en >= ${utc(rango.desde)} AND o.creada_en < ${utc(rango.hasta)}`
    );
    const [eventos] = await consultar<{ vistas: string; clicks: string; conversiones: string; busquedas: string; sinResultados: string }>(
      this.db,
      sql`
        SELECT SUM(tipo_evento = 'vista_producto') AS vistas,
               SUM(tipo_evento = 'click_oferta') AS clicks,
               SUM(tipo_evento = 'click_oferta' AND convirtio = 1) AS conversiones,
               SUM(tipo_evento = 'busqueda') AS busquedas,
               SUM(tipo_evento = 'busqueda' AND resultados = 0) AS sinResultados
        FROM evento_analitico
        WHERE creado_en >= ${utc(rango.desde)} AND creado_en < ${utc(rango.hasta)}`
    );

    const ordenes = n(ventas?.ordenes);
    const gmv = n(ventas?.gmv);
    const clicks = n(eventos?.clicks);
    const conversiones = n(eventos?.conversiones);
    return {
      ordenes,
      gmv,
      ticketPromedio: ordenes === 0 ? null : Math.round(gmv / ordenes),
      comisiones: n(ventas?.comisiones),
      proveedoresConVentas: n(ventas?.proveedores),
      clientesConCompras: n(ventas?.clientes),
      vistas: n(eventos?.vistas),
      clicks,
      conversiones,
      tasaConversion: tasa(conversiones, clicks),
      busquedas: n(eventos?.busquedas),
      busquedasSinResultados: n(eventos?.sinResultados)
    };
  }

  // Plan: range scan en ix_evento_analitico_tipo_evento (tipo_evento,
  // creado_en) sobre las particiones del rango.
  async terminosSinResultados(rango: RangoFechas, limite = 10): Promise<TerminoSinResultados[]> {
    const filas = await consultar<{ termino: string; veces: number }>(
      this.db,
      sql`
        SELECT LOWER(TRIM(termino)) AS termino, COUNT(*) AS veces
        FROM evento_analitico
        WHERE tipo_evento = 'busqueda' AND resultados = 0
          AND creado_en >= ${utc(rango.desde)} AND creado_en < ${utc(rango.hasta)}
        GROUP BY LOWER(TRIM(termino))
        ORDER BY veces DESC, termino
        LIMIT ${limite}`
    );
    return filas.map((f) => ({ termino: f.termino, veces: n(f.veces) }));
  }
}
