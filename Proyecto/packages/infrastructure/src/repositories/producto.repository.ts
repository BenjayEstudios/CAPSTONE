import { and, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type {
  CambiosProducto,
  FiltrosProductos,
  NuevoProducto,
  PaginaProductos,
  Producto,
  ProductoImagen,
  ProductoListado,
  ProductoRepository,
  ResumenOfertas
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { categoria } from "../db/schema/categoria.schema.js";
import { oferta } from "../db/schema/oferta.schema.js";
import { producto } from "../db/schema/producto.schema.js";

type ProductoRow = typeof producto.$inferSelect;

// producto.imagenes (JSON del DBML) usa claves snake_case.
interface ImagenJson {
  url: string;
  texto_alt: string | null;
  orden: number;
  es_principal: boolean;
  subida_por: number | null;
  subida_en: string;
  ancho?: number;
  alto?: number;
}

function imagenToJson(i: ProductoImagen): ImagenJson {
  const j: ImagenJson = {
    url: i.url,
    texto_alt: i.textoAlt,
    orden: i.orden,
    es_principal: i.esPrincipal,
    subida_por: i.subidaPor,
    subida_en: i.subidaEn
  };
  if (i.ancho !== undefined) j.ancho = i.ancho;
  if (i.alto !== undefined) j.alto = i.alto;
  return j;
}

function imagenFromJson(j: ImagenJson): ProductoImagen {
  const i: ProductoImagen = {
    url: j.url,
    textoAlt: j.texto_alt ?? null,
    orden: j.orden ?? 0,
    esPrincipal: !!j.es_principal,
    subidaPor: j.subida_por ?? null,
    subidaEn: j.subida_en
  };
  if (j.ancho !== undefined) i.ancho = j.ancho;
  if (j.alto !== undefined) i.alto = j.alto;
  return i;
}

function parseImagenes(raw: unknown): ProductoImagen[] {
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? (arr as ImagenJson[]).map(imagenFromJson) : [];
}

function toEntity(f: ProductoRow): Producto {
  return {
    id: f.id,
    categoriaId: f.categoriaId,
    sku: f.sku,
    ean: f.ean,
    nombre: f.nombre,
    marca: f.marca,
    formato: f.formato,
    contenido: f.contenido === null ? null : Number(f.contenido),
    unidad: f.unidad,
    descripcion: f.descripcion,
    precioReferencia: f.precioReferencia,
    topeSobreReferenciaPct: f.topeSobreReferenciaPct,
    imagenes: parseImagenes(f.imagenes),
    estado: f.estado,
    creadoPor: f.creadoPor,
    creadoEn: f.creadoEn
  };
}

const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Implementacion Drizzle/MySQL del puerto ProductoRepository.
export class DrizzleProductoRepository implements ProductoRepository {
  constructor(private readonly db: DbClient) {}

  async listar(filtros: FiltrosProductos): Promise<PaginaProductos> {
    const condiciones: SQL[] = [];
    if (filtros.estado) condiciones.push(eq(producto.estado, filtros.estado));
    if (filtros.categoriaIds) {
      // inArray con lista vacia no matchea nada.
      condiciones.push(inArray(producto.categoriaId, filtros.categoriaIds));
    }
    if (filtros.q) {
      const patron = `%${escaparLike(filtros.q)}%`;
      const busqueda = or(like(producto.nombre, patron), like(producto.sku, patron), like(producto.ean, patron));
      if (busqueda) condiciones.push(busqueda);
    }
    const where = condiciones.length > 0 ? and(...condiciones) : undefined;

    const [{ total }] = await this.db.select({ total: count() }).from(producto).where(where);

    // "Oferta activa" = oferta.estado = 'publicada'.
    const filas = await this.db
      .select({
        id: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        ean: producto.ean,
        categoriaId: producto.categoriaId,
        categoriaNombre: categoria.nombre,
        formato: producto.formato,
        imagenes: producto.imagenes,
        estado: producto.estado,
        proveedores: sql<number>`(select count(distinct ${oferta.proveedorId}) from ${oferta} where ${oferta.productoId} = ${producto.id} and ${oferta.estado} = 'publicada')`,
        precioDesde: sql<number | null>`(select min(${oferta.precioUnitario}) from ${oferta} where ${oferta.productoId} = ${producto.id} and ${oferta.estado} = 'publicada')`
      })
      .from(producto)
      .innerJoin(categoria, eq(producto.categoriaId, categoria.id))
      .where(where)
      .orderBy(desc(producto.id))
      .limit(filtros.tamano)
      .offset((filtros.pagina - 1) * filtros.tamano);

    const items: ProductoListado[] = filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      sku: f.sku,
      ean: f.ean,
      categoria: { id: f.categoriaId, nombre: f.categoriaNombre },
      formato: f.formato,
      proveedoresConOfertaActiva: Number(f.proveedores ?? 0),
      precioDesde: f.precioDesde === null || f.precioDesde === undefined ? null : Number(f.precioDesde),
      nImagenes: parseImagenes(f.imagenes).length,
      estado: f.estado
    }));
    return { items, total: Number(total) };
  }

  private async uno(cond: SQL): Promise<Producto | null> {
    const [fila] = await this.db.select().from(producto).where(cond).limit(1);
    return fila ? toEntity(fila) : null;
  }

  buscarPorId(id: number) {
    return this.uno(eq(producto.id, id));
  }
  buscarPorSku(sku: string) {
    return this.uno(eq(producto.sku, sku));
  }
  buscarPorEan(ean: string) {
    return this.uno(eq(producto.ean, ean));
  }

  async resumenOfertas(productoId: number): Promise<ResumenOfertas> {
    const [f] = await this.db
      .select({
        proveedores: sql<number>`count(distinct ${oferta.proveedorId})`,
        precioDesde: sql<number | null>`min(${oferta.precioUnitario})`
      })
      .from(oferta)
      .where(and(eq(oferta.productoId, productoId), eq(oferta.estado, "publicada")));
    return {
      proveedoresConOfertaActiva: Number(f?.proveedores ?? 0),
      precioDesde: f?.precioDesde === null || f?.precioDesde === undefined ? null : Number(f.precioDesde)
    };
  }

  async crear(input: NuevoProducto): Promise<Producto> {
    const [{ id }] = await this.db
      .insert(producto)
      .values({
        categoriaId: input.categoriaId,
        sku: input.sku,
        ean: input.ean ?? null,
        nombre: input.nombre,
        marca: input.marca ?? null,
        formato: input.formato ?? null,
        contenido: input.contenido === undefined || input.contenido === null ? null : String(input.contenido),
        unidad: input.unidad,
        descripcion: input.descripcion ?? null,
        precioReferencia: input.precioReferencia ?? null,
        topeSobreReferenciaPct: input.topeSobreReferenciaPct ?? null,
        imagenes: [],
        estado: input.estado,
        creadoPor: input.creadoPor
      })
      .$returningId();
    const creado = await this.buscarPorId(id);
    if (!creado) throw new Error("Producto recien creado no encontrado");
    return creado;
  }

  async actualizar(id: number, cambios: CambiosProducto): Promise<Producto> {
    const { imagenes, contenido, ...resto } = cambios;
    const set: Partial<typeof producto.$inferInsert> = { ...resto };
    if (contenido !== undefined) set.contenido = contenido === null ? null : String(contenido);
    if (imagenes !== undefined) set.imagenes = imagenes.map(imagenToJson);
    await this.db.update(producto).set(set).where(eq(producto.id, id));
    const actualizado = await this.buscarPorId(id);
    if (!actualizado) throw new Error("Producto actualizado no encontrado");
    return actualizado;
  }
}
