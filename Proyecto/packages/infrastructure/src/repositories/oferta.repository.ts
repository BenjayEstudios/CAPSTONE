import { and, asc, count, desc, eq, like, notExists, or, sql, type SQL } from "drizzle-orm";
import type {
  CambioPrecioStock,
  DatosOferta,
  NuevaOferta,
  OfertaEstado,
  OfertaProveedorDto,
  OfertaRepository,
  ProductoDisponibleDto,
  ProductoParaOfertar,
  CambioOfertaDto,
  ComparacionOfertaDto
} from "@cotizapp/domain";
import { consultar, type DbClient } from "../db/client.js";
import { oferta } from "../db/schema/oferta.schema.js";
import { ofertaPrecioHistorial } from "../db/schema/oferta-precio-historial.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { producto } from "../db/schema/producto.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

const patron = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

// Implementacion Drizzle/MySQL del puerto OfertaRepository (KAN-146).
export class DrizzleOfertaRepository implements OfertaRepository {
  constructor(private readonly db: DbClient) {}

  private consulta() {
    return this.db
      .select({
        oferta,
        producto: {
          id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre,
          formato: producto.formato,
          unidad: producto.unidad,
          contenido: producto.contenido,
          precioReferencia: producto.precioReferencia,
          topeSobreReferenciaPct: producto.topeSobreReferenciaPct
        }
      })
      .from(oferta)
      .innerJoin(producto, eq(oferta.productoId, producto.id));
  }

  private static aDto(f: { oferta: typeof oferta.$inferSelect; producto: Omit<OfertaProveedorDto["producto"], "contenido"> & { contenido: string | null } }): OfertaProveedorDto {
    const { cajasIniciales, ...o } = f.oferta;
    return { ...o, cajasIniciales, producto: { ...f.producto, contenido: f.producto.contenido === null ? null : Number(f.producto.contenido) } };
  }

  async listarDeProveedor(proveedorId: number, f: { estado?: OfertaEstado; q?: string; pagina: number; tamano: number }) {
    const cond: SQL[] = [eq(oferta.proveedorId, proveedorId)];
    if (f.estado) cond.push(eq(oferta.estado, f.estado));
    if (f.q) cond.push(or(like(producto.nombre, patron(f.q)), like(producto.sku, patron(f.q))) as SQL);
    const where = and(...cond);
    const filas = await this.consulta()
      .where(where)
      .orderBy(desc(oferta.actualizadaEn), desc(oferta.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(oferta)
      .innerJoin(producto, eq(oferta.productoId, producto.id))
      .where(where);
    return { items: filas.map(DrizzleOfertaRepository.aDto), total };
  }

  async buscarPorId(id: number): Promise<OfertaProveedorDto | null> {
    const [f] = await this.consulta().where(eq(oferta.id, id)).limit(1);
    return f ? DrizzleOfertaRepository.aDto(f) : null;
  }

  async buscarPorProductoYProveedor(productoId: number, proveedorId: number): Promise<OfertaProveedorDto | null> {
    const [f] = await this.consulta()
      .where(and(eq(oferta.productoId, productoId), eq(oferta.proveedorId, proveedorId)))
      .limit(1);
    return f ? DrizzleOfertaRepository.aDto(f) : null;
  }

  async productoParaOfertar(productoId: number): Promise<ProductoParaOfertar | null> {
    const [p] = await this.db
      .select({
        id: producto.id,
        nombre: producto.nombre,
        estado: producto.estado,
        precioReferencia: producto.precioReferencia,
        topeSobreReferenciaPct: producto.topeSobreReferenciaPct
      })
      .from(producto)
      .where(eq(producto.id, productoId))
      .limit(1);
    return p ?? null;
  }

  async productosDisponibles(proveedorId: number, f: { q?: string; categoriaId?: number; pagina: number; tamano: number }) {
    const yaOfertado = this.db
      .select({ uno: sql`1` })
      .from(oferta)
      .where(and(eq(oferta.productoId, producto.id), eq(oferta.proveedorId, proveedorId)));
    const cond: SQL[] = [eq(producto.estado, "publicado"), notExists(yaOfertado)];
    if (f.categoriaId) {
      // La categoria y sus subcategorias (arbol de 2 niveles).
      cond.push(sql`${producto.categoriaId} IN (SELECT id FROM categoria WHERE id = ${f.categoriaId} OR padre_id = ${f.categoriaId})`);
    }
    if (f.q) cond.push(or(like(producto.nombre, patron(f.q)), like(producto.marca, patron(f.q)), like(producto.sku, patron(f.q))) as SQL);
    const where = and(...cond);
    const filas = await this.db
      .select({
        id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        marca: producto.marca,
        formato: producto.formato,
        unidad: producto.unidad,
        contenido: producto.contenido,
        categoriaId: producto.categoriaId,
        precioReferencia: producto.precioReferencia,
        topeSobreReferenciaPct: producto.topeSobreReferenciaPct
      })
      .from(producto)
      .where(where)
      .orderBy(asc(producto.nombre))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    const items: ProductoDisponibleDto[] = filas.map((f) => ({ ...f, contenido: f.contenido === null ? null : Number(f.contenido) }));
    const [{ total }] = await this.db.select({ total: count() }).from(producto).where(where);
    return { items, total };
  }

  async tieneVentas(ofertaId: number): Promise<boolean> {
    const [f] = await this.db.select({ id: ordenLinea.id }).from(ordenLinea).where(eq(ordenLinea.ofertaId, ofertaId)).limit(1);
    return !!f;
  }

  async crear(o: NuevaOferta, historial: CambioPrecioStock): Promise<OfertaProveedorDto> {
    const id = await this.db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(oferta)
        .values({ ...o, cajasIniciales: o.cajasDisponibles })
        .$returningId();
      await tx.insert(ofertaPrecioHistorial).values({ ofertaId: id, ...historial });
      return id;
    });
    return (await this.buscarPorId(id)) as OfertaProveedorDto;
  }

  async actualizar(id: number, cambios: Partial<DatosOferta>, historial: CambioPrecioStock | null): Promise<OfertaProveedorDto> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(oferta)
        .set({ ...cambios, actualizadaEn: sql`CURRENT_TIMESTAMP` })
        .where(eq(oferta.id, id));
      if (historial) await tx.insert(ofertaPrecioHistorial).values({ ofertaId: id, ...historial });
    });
    return (await this.buscarPorId(id)) as OfertaProveedorDto;
  }

  async historial(ofertaId: number, limite: number): Promise<CambioOfertaDto[]> {
    return this.db
      .select({
        id: ofertaPrecioHistorial.id,
        precioAnterior: ofertaPrecioHistorial.precioAnterior,
        precioNuevo: ofertaPrecioHistorial.precioNuevo,
        cajasAnteriores: ofertaPrecioHistorial.cajasAnteriores,
        cajasNuevas: ofertaPrecioHistorial.cajasNuevas,
        motivo: ofertaPrecioHistorial.motivo,
        cambiadoPor: usuario.nombre,
        cambiadoEn: ofertaPrecioHistorial.cambiadoEn
      })
      .from(ofertaPrecioHistorial)
      .leftJoin(usuario, eq(usuario.id, ofertaPrecioHistorial.cambiadoPor))
      .where(eq(ofertaPrecioHistorial.ofertaId, ofertaId))
      .orderBy(desc(ofertaPrecioHistorial.cambiadoEn), desc(ofertaPrecioHistorial.id))
      .limit(limite);
  }

  // Una consulta: cada oferta publicada mia con el conteo, el minimo y las
  // mas baratas entre las visibles del mismo producto (publicadas de
  // proveedores activos, la misma regla que el catalogo).
  async comparacion(proveedorId: number): Promise<ComparacionOfertaDto[]> {
    const filas = await consultar<{ ofertaId: number; productoId: number; producto: string; formato: string | null; miPrecio: number; total: number; masBaratas: number; precioMasBajo: number }>(
      this.db,
      sql`
        SELECT mia.id AS ofertaId, p.id AS productoId, p.nombre AS producto, p.formato, mia.precio_unitario AS miPrecio,
               COUNT(o.id) AS total,
               SUM(o.precio_unitario < mia.precio_unitario) AS masBaratas,
               MIN(o.precio_unitario) AS precioMasBajo
        FROM oferta mia
        JOIN producto p ON p.id = mia.producto_id
        JOIN oferta o ON o.producto_id = mia.producto_id AND o.estado = 'publicada'
        JOIN organizacion org ON org.id = o.proveedor_id AND org.estado = 'activa'
        WHERE mia.proveedor_id = ${proveedorId} AND mia.estado = 'publicada'
        GROUP BY mia.id, p.id, p.nombre, p.formato, mia.precio_unitario
        ORDER BY p.nombre`
    );
    return filas.map((f) => {
      const miPrecio = Number(f.miPrecio);
      const precioMasBajo = Number(f.precioMasBajo);
      return {
        ofertaId: f.ofertaId, productoId: f.productoId, producto: f.producto, formato: f.formato, miPrecio,
        posicion: Number(f.masBaratas) + 1, total: Number(f.total), precioMasBajo, diferencia: miPrecio - precioMasBajo
      };
    });
  }

  async eliminar(id: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(ofertaPrecioHistorial).where(eq(ofertaPrecioHistorial.ofertaId, id));
      await tx.delete(oferta).where(eq(oferta.id, id));
    });
  }
}
