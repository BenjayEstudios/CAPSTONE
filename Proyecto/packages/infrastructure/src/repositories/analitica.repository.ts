import { sql } from "drizzle-orm";
import type {
  AnaliticaRepository,
  EmbudoProducto,
  PotencialesComuna,
  StockDelMes,
  KpisPlataforma,
  RangoFechasAnalitica,
  TerminoSinResultados,
  VentaProducto,
  VentaSemanal,
  PendientesProveedor
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
const ventaDelProveedor = (proveedorId: number, rango: RangoFechasAnalitica) => sql`
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
  async ventasPorSemana(proveedorId: number, rango: RangoFechasAnalitica): Promise<VentaSemanal[]> {
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
  async ventasPorProducto(proveedorId: number, rango: RangoFechasAnalitica, limite = 10): Promise<VentaProducto[]> {
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
  // Panel del proveedor (KAN-101). Cuatro consultas chicas por indice de
  // proveedor: ofertas (stock y conteo por estado), envios entregados sin
  // liquidar y por despachar, y liquidaciones pendientes.
  async pendientesProveedor(proveedorId: number, umbralStock: number): Promise<PendientesProveedor> {
    const [stockBajo, [ofertas], [envios], [liquidaciones]] = await Promise.all([
      consultar<{ ofertaId: number; productoId: number; producto: string; cajasDisponibles: number; cajasIniciales: number | null }>(
        this.db,
        sql`
          SELECT o.id AS ofertaId, o.producto_id AS productoId, p.nombre AS producto,
                 o.cajas_disponibles AS cajasDisponibles, o.cajas_iniciales AS cajasIniciales
          FROM oferta o JOIN producto p ON p.id = o.producto_id
          WHERE o.proveedor_id = ${proveedorId} AND o.estado = 'publicada'
            AND o.cajas_disponibles IS NOT NULL AND o.cajas_disponibles <= ${umbralStock}
          ORDER BY o.cajas_disponibles, o.id`
      ),
      consultar<{ publicadas: string; borradores: string }>(
        this.db,
        sql`
          SELECT COALESCE(SUM(estado = 'publicada'), 0) AS publicadas, COALESCE(SUM(estado = 'borrador'), 0) AS borradores
          FROM oferta WHERE proveedor_id = ${proveedorId}`
      ),
      consultar<{ sinLiquidar: string; porDespachar: string }>(
        this.db,
        sql`
          SELECT COALESCE(SUM(CASE WHEN oe.estado = 'entregado' AND oe.liquidacion_id IS NULL
                                   THEN oe.subtotal + COALESCE(oe.costo_despacho, 0) - oe.comision_monto END), 0) AS sinLiquidar,
                 COALESCE(SUM(oe.estado = 'por_despachar' AND o.estado_pago = 'pagado'), 0) AS porDespachar
          FROM orden_envio oe JOIN orden o ON o.id = oe.orden_id
          WHERE oe.proveedor_id = ${proveedorId}`
      ),
      consultar<{ pendientes: string }>(
        this.db,
        sql`SELECT COALESCE(SUM(monto_neto), 0) AS pendientes FROM liquidacion WHERE proveedor_id = ${proveedorId} AND estado = 'pendiente'`
      )
    ]);
    return {
      stockBajo: stockBajo.map((f) => ({ ...f, cajasDisponibles: n(f.cajasDisponibles), cajasIniciales: f.cajasIniciales === null ? null : n(f.cajasIniciales) })),
      entregadoSinLiquidar: n(envios?.sinLiquidar),
      liquidacionesPendientes: n(liquidaciones?.pendientes),
      enviosPorDespachar: n(envios?.porDespachar),
      ofertasPublicadas: n(ofertas?.publicadas),
      ofertasBorrador: n(ofertas?.borradores)
    };
  }

  async embudoPorProducto(proveedorId: number, rango: RangoFechasAnalitica): Promise<EmbudoProducto[]> {
    const filas = await consultar<{
      ofertaId: number; productoId: number; nombre: string; formato: string | null; estadoOferta: EmbudoProducto["estadoOferta"];
      vistas: number; clicks: number; conversiones: number; cajasVendidas: string | null;
    }>(
      this.db,
      sql`
        SELECT f.id AS ofertaId, f.producto_id AS productoId, p.nombre, p.formato, f.estado AS estadoOferta,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.producto_id = f.producto_id AND e.tipo_evento = 'vista_producto'
              AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS vistas,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.oferta_id = f.id AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS clicks,
          (SELECT COUNT(*) FROM evento_analitico e
            WHERE e.oferta_id = f.id AND e.convirtio = 1
              AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}) AS conversiones,
          -- Venta = envio no cancelado de una orden pagada, fechada por la orden (como ventasPorProducto).
          (SELECT SUM(l.cantidad) FROM orden_linea l
            JOIN orden_envio oe ON oe.id = l.orden_envio_id AND oe.estado <> 'cancelado'
            JOIN orden o ON o.id = oe.orden_id AND o.estado_pago = 'pagado'
            WHERE l.oferta_id = f.id AND o.creada_en >= ${utc(rango.desde)} AND o.creada_en < ${utc(rango.hasta)}) AS cajasVendidas
        FROM oferta f
        JOIN producto p ON p.id = f.producto_id
        WHERE f.proveedor_id = ${proveedorId}
        ORDER BY f.producto_id`
    );
    return filas.map((f) => ({
      ofertaId: f.ofertaId,
      productoId: f.productoId,
      nombre: f.nombre,
      formato: f.formato,
      estadoOferta: f.estadoOferta,
      cajasVendidas: n(f.cajasVendidas),
      vistas: n(f.vistas),
      clicks: n(f.clicks),
      conversiones: n(f.conversiones),
      tasaClick: tasa(n(f.clicks), n(f.vistas)),
      tasaConversion: tasa(n(f.conversiones), n(f.clicks))
    }));
  }

  // Ofertas publicadas del proveedor (KAN-107). Las cajas del inicio del mes
  // salen del ultimo cambio de stock anterior al mes en
  // oferta_precio_historial (por su FK oferta_id); si no hay, de las cajas
  // iniciales de la oferta.
  async stockDelMes(proveedorId: number, inicioMes: Date): Promise<StockDelMes[]> {
    const filas = await consultar<{
      ofertaId: number; productoId: number; nombre: string; formato: string | null; cajasDisponibles: number | null;
      antesDelMes: number | null; cajasIniciales: number | null;
    }>(
      this.db,
      sql`
        SELECT f.id AS ofertaId, f.producto_id AS productoId, p.nombre, p.formato, f.cajas_disponibles AS cajasDisponibles,
          (SELECT h.cajas_nuevas FROM oferta_precio_historial h
            WHERE h.oferta_id = f.id AND h.cajas_nuevas IS NOT NULL AND h.cambiado_en < ${utc(inicioMes)}
            ORDER BY h.cambiado_en DESC, h.id DESC LIMIT 1) AS antesDelMes,
          f.cajas_iniciales AS cajasIniciales
        FROM oferta f
        JOIN producto p ON p.id = f.producto_id
        WHERE f.proveedor_id = ${proveedorId} AND f.estado = 'publicada'`
    );
    return filas.map((f) => ({
      ofertaId: f.ofertaId,
      productoId: f.productoId,
      nombre: f.nombre,
      formato: f.formato,
      cajasDisponibles: n(f.cajasDisponibles),
      cajasInicioMes: f.antesDelMes ?? f.cajasIniciales ?? null
    }));
  }

  // Clientes potenciales (KAN-107): organizaciones cuyos usuarios vieron (con
  // sesion iniciada) un producto que el proveedor ofrece y que en el mismo
  // rango se lo compraron a otro proveedor (envio no cancelado de una orden
  // pagada). Se ubican por la comuna de entrega de esa orden, o la de la
  // organizacion si fue retiro. Las vistas anonimas no cuentan: no se pueden
  // ligar a una compra. "cubre" mira proveedor_cobertura por comuna o region.
  async potencialesPorComuna(proveedorId: number, rango: RangoFechasAnalitica): Promise<PotencialesComuna[]> {
    const filas = await consultar<{ comunaId: number; comuna: string; region: string; clientes: number; cubre: number }>(
      this.db,
      sql`
        SELECT c.id AS comunaId, c.nombre AS comuna, c.region_nombre AS region, COUNT(DISTINCT x.organizacionId) AS clientes,
          EXISTS (SELECT 1 FROM proveedor_cobertura pc
                  WHERE pc.proveedor_id = ${proveedorId}
                    AND (pc.comuna_id = c.id OR (pc.comuna_id IS NULL AND pc.region_codigo = c.region_codigo))) AS cubre
        FROM (
          SELECT DISTINCT o.organizacion_id AS organizacionId, COALESCE(de.comuna_id, dorg.comuna_id) AS comunaId
          FROM evento_analitico e
          JOIN usuario u ON u.id = e.usuario_id
          JOIN oferta mia ON mia.producto_id = e.producto_id AND mia.proveedor_id = ${proveedorId}
          JOIN orden o ON o.organizacion_id = u.organizacion_id AND o.estado_pago = 'pagado'
            AND o.creada_en >= ${utc(rango.desde)} AND o.creada_en < ${utc(rango.hasta)}
          JOIN orden_envio oe ON oe.orden_id = o.id AND oe.proveedor_id <> ${proveedorId} AND oe.estado <> 'cancelado'
          JOIN orden_linea l ON l.orden_envio_id = oe.id AND l.producto_id = e.producto_id
          JOIN organizacion org ON org.id = o.organizacion_id
          LEFT JOIN direccion de ON de.id = o.direccion_entrega_id
          LEFT JOIN direccion dorg ON dorg.id = org.direccion_id
          WHERE e.tipo_evento = 'vista_producto'
            AND e.creado_en >= ${utc(rango.desde)} AND e.creado_en < ${utc(rango.hasta)}
        ) x
        JOIN comuna c ON c.id = x.comunaId
        GROUP BY c.id, c.nombre, c.region_nombre, c.region_codigo`
    );
    return filas.map((f) => ({ comunaId: f.comunaId, comuna: f.comuna, region: f.region, clientes: n(f.clientes), cubre: n(f.cubre) === 1 }));
  }

  // Dos consultas: ventas (ix_orden_estado_pago (estado_pago, creada_en))
  // y eventos (recorre solo las particiones del rango, que es lo que hay que
  // leer para contar todo).
  async kpisPlataforma(rango: RangoFechasAnalitica): Promise<KpisPlataforma> {
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
  async terminosSinResultados(rango: RangoFechasAnalitica, limite = 10): Promise<TerminoSinResultados[]> {
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
