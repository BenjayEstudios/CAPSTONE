import { sql, type SQL } from "drizzle-orm";
import type {
  CatalogoRepository,
  FichaCatalogoBase,
  FiltrosCatalogo,
  OfertaCatalogoBase,
  ProductoCatalogoDto,
  ProductoUnidad,
  ZonaComprador
} from "@cotizapp/domain";
import { consultar, type DbClient } from "../db/client.js";

// Implementacion MySQL del catalogo publico (KAN-145). SQL escrito a mano:
// agrega por producto sobre las ofertas visibles y usa el FULLTEXT
// ix_producto_nombre_fulltext (migracion 0001, KAN-140), que Drizzle no
// sabe expresar.

// mysql2 devuelve DECIMAL como string y JSON ya parseado (u ocasionalmente string).
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function imagenPrincipal(imagenes: unknown): string | null {
  let lista: unknown = imagenes;
  if (typeof lista === "string") {
    try {
      lista = JSON.parse(lista);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const imgs = lista as Array<{ url?: string; es_principal?: boolean; orden?: number }>;
  const elegida = imgs.find((i) => i.es_principal) ?? [...imgs].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];
  return elegida?.url ?? null;
}

// Plural simple del espanol, porque FULLTEXT no hace stemming: "quesos" ->
// "queso", "aceites" -> "aceit", "limones" -> "limon". Con el comodin de
// prefijo, la raiz encuentra singular y plural.
function singular(t: string): string {
  if (t.length >= 5 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length >= 4 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

// "Aceites de oliva" -> "+aceit* +oliva*" (palabras de 3+ letras: el minimo de
// InnoDB FULLTEXT). Se quitan los operadores del modo booleano.
export function terminoFulltext(q: string): string {
  return q
    .toLowerCase()
    .replace(/[+\-<>()~*"@]/g, " ")
    .split(/\s+/)
    .map(singular)
    .filter((t) => t.length >= 3)
    .map((t) => `+${t}*`)
    .join(" ");
}

const patronLike = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export class DrizzleCatalogoRepository implements CatalogoRepository {
  constructor(private readonly db: DbClient) {}

  async listar(f: FiltrosCatalogo): Promise<{ items: ProductoCatalogoDto[]; total: number }> {
    const condProducto: SQL[] = [sql`p.estado = 'publicado'`, sql`c.estado = 'activa'`, sql`(cp.id IS NULL OR cp.estado = 'activa')`];
    const condOferta: SQL[] = [sql`o.estado = 'publicada'`, sql`org.estado = 'activa'`];
    if (f.categoriaIds?.length) condProducto.push(sql`p.categoria_id IN (${sql.join(f.categoriaIds.map((id) => sql`${id}`), sql`, `)})`);
    if (f.plazoMaxHoras !== undefined) condOferta.push(sql`o.plazo_horas <= ${f.plazoMaxHoras}`);
    if (f.maxUnidadesPorCaja !== undefined) condOferta.push(sql`o.unidades_por_caja <= ${f.maxUnidadesPorCaja}`);

    const ft = f.q ? terminoFulltext(f.q) : "";
    const relevancia = ft ? sql`MATCH(p.nombre) AGAINST(${ft} IN BOOLEAN MODE)` : sql`0`;
    if (f.q) {
      const like = patronLike(f.q);
      condProducto.push(
        ft
          ? sql`(MATCH(p.nombre) AGAINST(${ft} IN BOOLEAN MODE) OR p.nombre LIKE ${like} OR p.marca LIKE ${like})`
          : sql`(p.nombre LIKE ${like} OR p.marca LIKE ${like})`
      );
    }
    const having = f.orden === "diferencia" ? sql`HAVING COUNT(*) >= 2` : sql``;

    const base = sql`
      FROM producto p
      JOIN categoria c ON c.id = p.categoria_id
      LEFT JOIN categoria cp ON cp.id = c.padre_id
      JOIN oferta o ON o.producto_id = p.id
      JOIN organizacion org ON org.id = o.proveedor_id
      WHERE ${sql.join([...condProducto, ...condOferta], sql` AND `)}
      GROUP BY p.id
      ${having}`;

    const orden = {
      relevancia: f.q ? sql`relevancia DESC, p.nombre ASC` : sql`p.nombre ASC`,
      precio: sql`precio_desde ASC, p.nombre ASC`,
      diferencia: sql`(MAX(o.precio_unitario) - MIN(o.precio_unitario)) DESC, p.nombre ASC`,
      nombre: sql`p.nombre ASC`
    }[f.orden];

    const filas = await consultar<Record<string, unknown>>(
      this.db,
      sql`SELECT p.id, p.sku, p.nombre, p.marca, p.formato, p.contenido, p.unidad, p.categoria_id, p.imagenes,
                 MIN(o.precio_unitario) AS precio_desde, MAX(o.precio_unitario) AS precio_hasta,
                 COUNT(*) AS ofertas, MIN(o.plazo_horas) AS plazo_min, ${relevancia} AS relevancia
          ${base}
          ORDER BY ${orden}
          LIMIT ${f.porPagina} OFFSET ${(f.pagina - 1) * f.porPagina}`
    );
    const [conteo] = await consultar<{ total: number }>(this.db, sql`SELECT COUNT(*) AS total FROM (SELECT p.id ${base}) t`);

    return {
      total: Number(conteo?.total ?? 0),
      items: filas.map((r) => ({
        id: Number(r.id),
        sku: String(r.sku),
        nombre: String(r.nombre),
        marca: (r.marca as string | null) ?? null,
        formato: (r.formato as string | null) ?? null,
        contenido: num(r.contenido),
        unidad: r.unidad as ProductoUnidad,
        categoriaId: Number(r.categoria_id),
        imagenUrl: imagenPrincipal(r.imagenes),
        precioDesde: Number(r.precio_desde),
        precioHasta: Number(r.precio_hasta),
        ofertas: Number(r.ofertas),
        plazoMinHoras: num(r.plazo_min)
      }))
    };
  }

  async obtenerFicha(productoId: number, zona: ZonaComprador): Promise<FichaCatalogoBase | null> {
    const [p] = await consultar<Record<string, unknown>>(
      this.db,
      sql`SELECT p.id, p.sku, p.nombre, p.marca, p.formato, p.contenido, p.unidad, p.categoria_id, p.imagenes,
                 p.descripcion, p.precio_referencia, c.nombre AS categoria_nombre, cp.id AS padre_id, cp.nombre AS padre_nombre
          FROM producto p
          JOIN categoria c ON c.id = p.categoria_id
          LEFT JOIN categoria cp ON cp.id = c.padre_id
          WHERE p.id = ${productoId} AND p.estado = 'publicado' AND c.estado = 'activa' AND (cp.id IS NULL OR cp.estado = 'activa')`
    );
    if (!p) return null;

    // Tarifa: la de la comuna del comprador; si no, la de su region; si el
    // proveedor tiene solo tarifas por comuna en la region, la mas barata.
    const ofertas = await consultar<Record<string, unknown>>(
      this.db,
      sql`SELECT o.id, o.precio_unitario, o.unidades_por_caja, o.cajas_disponibles, o.minimo_compra, o.plazo_horas,
                 o.modalidad_entrega, o.notas_cliente, org.id AS proveedor_id,
                 COALESCE(org.nombre_fantasia, org.razon_social) AS proveedor_nombre,
                 org.entregas_a_tiempo_pct, org.despacho_gratis_desde,
                 COALESCE(
                   (SELECT pc.costo_despacho FROM proveedor_cobertura pc
                     WHERE pc.proveedor_id = org.id AND pc.region_codigo = ${zona.regionCodigo} AND pc.comuna_id = ${zona.comunaId} LIMIT 1),
                   (SELECT pc.costo_despacho FROM proveedor_cobertura pc
                     WHERE pc.proveedor_id = org.id AND pc.region_codigo = ${zona.regionCodigo} AND pc.comuna_id IS NULL LIMIT 1),
                   (SELECT MIN(pc.costo_despacho) FROM proveedor_cobertura pc
                     WHERE pc.proveedor_id = org.id AND pc.region_codigo = ${zona.regionCodigo})
                 ) AS costo_despacho
          FROM oferta o
          JOIN organizacion org ON org.id = o.proveedor_id
          WHERE o.producto_id = ${productoId} AND o.estado = 'publicada' AND org.estado = 'activa'
          ORDER BY o.precio_unitario ASC, o.id ASC`
    );

    return {
      id: Number(p.id),
      sku: String(p.sku),
      nombre: String(p.nombre),
      marca: (p.marca as string | null) ?? null,
      formato: (p.formato as string | null) ?? null,
      contenido: num(p.contenido),
      unidad: p.unidad as ProductoUnidad,
      categoriaId: Number(p.categoria_id),
      imagenUrl: imagenPrincipal(p.imagenes),
      descripcion: (p.descripcion as string | null) ?? null,
      precioReferencia: num(p.precio_referencia),
      categoria: {
        id: Number(p.categoria_id),
        nombre: String(p.categoria_nombre),
        padre: p.padre_id === null ? null : { id: Number(p.padre_id), nombre: String(p.padre_nombre) }
      },
      ofertas: ofertas.map(
        (o): OfertaCatalogoBase => ({
          id: Number(o.id),
          precioUnitario: Number(o.precio_unitario),
          unidadesPorCaja: num(o.unidades_por_caja),
          cajasDisponibles: num(o.cajas_disponibles),
          minimoCompra: num(o.minimo_compra),
          plazoHoras: num(o.plazo_horas),
          modalidadEntrega: o.modalidad_entrega as OfertaCatalogoBase["modalidadEntrega"],
          notasCliente: (o.notas_cliente as string | null) ?? null,
          proveedor: {
            id: Number(o.proveedor_id),
            nombre: String(o.proveedor_nombre),
            entregasATiempoPct: num(o.entregas_a_tiempo_pct),
            despachoGratisDesde: num(o.despacho_gratis_desde),
            costoDespacho: num(o.costo_despacho)
          }
        })
      )
    };
  }

  async zonaDeOrganizacion(organizacionId: number): Promise<ZonaComprador | null> {
    const [z] = await consultar<{ region_codigo: string; comuna_id: number }>(
      this.db,
      sql`SELECT cm.region_codigo, cm.id AS comuna_id
          FROM organizacion org
          JOIN direccion d ON d.id = org.direccion_id
          JOIN comuna cm ON cm.id = d.comuna_id
          WHERE org.id = ${organizacionId}`
    );
    return z ? { regionCodigo: z.region_codigo, comunaId: Number(z.comuna_id) } : null;
  }
}
