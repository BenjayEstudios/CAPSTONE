import {
  fichaCatalogoQuerySchema,
  listarCatalogoQuerySchema,
  type CalificacionRepository,
  type CatalogoRepository,
  type CategoriaRepository,
  type FichaCatalogoDto,
  type PaginaCatalogoDto,
  type PrecioNormalizadoDto,
  type ProductoUnidad,
  type ZonaComprador
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

/** Region Metropolitana: la zona por defecto cuando no se conoce la del comprador. */
export const ZONA_POR_DEFECTO: ZonaComprador = { regionCodigo: "13", comunaId: null };

// GET /catalogo/productos (KAN-145): listado publico con busqueda y filtros.
// Filtrar por una categoria padre incluye sus subcategorias.
export function listarCatalogo(deps: { catalogoRepository: CatalogoRepository; categoriaRepository: CategoriaRepository }) {
  return async (input: unknown): Promise<PaginaCatalogoDto> => {
    const f = validar(listarCatalogoQuerySchema, input);
    let categoriaIds: number[] | undefined;
    if (f.categoriaId !== undefined) {
      const todas = await deps.categoriaRepository.listar();
      categoriaIds = [f.categoriaId, ...todas.filter((c) => c.padreId === f.categoriaId).map((c) => c.id)];
    }
    const { items, total } = await deps.catalogoRepository.listar({
      q: f.q,
      categoriaIds,
      plazoMaxHoras: f.plazoMaxHoras,
      maxUnidadesPorCaja: f.maxUnidadesPorCaja,
      orden: f.orden,
      pagina: f.pagina,
      porPagina: f.porPagina
    });
    return { items, total, pagina: f.pagina, porPagina: f.porPagina };
  };
}

/** Precio por kg, L o unidad: precio unitario / contenido, redondeado al peso. */
export function precioNormalizado(precioUnitario: number, contenido: number | null, unidad: ProductoUnidad): PrecioNormalizadoDto | null {
  if (!contenido || contenido <= 0) return null;
  return { valor: Math.round(precioUnitario / contenido), por: unidad };
}

// GET /catalogo/productos/:id (KAN-145): ficha con el comparador. Las
// ofertas van por precio unitario ascendente (desempate: precio por kg/L).
// organizacionId (opcional) = comprador logueado: su zona decide la tarifa
// de despacho; sin comprador o sin direccion, la RM.
export function obtenerFichaCatalogo(deps: {
  catalogoRepository: CatalogoRepository;
  calificacionRepository: CalificacionRepository;
}) {
  return async (productoId: number, query: unknown, organizacionId?: number): Promise<FichaCatalogoDto> => {
    validar(fichaCatalogoQuerySchema, query);
    const zona = (organizacionId ? await deps.catalogoRepository.zonaDeOrganizacion(organizacionId) : null) ?? ZONA_POR_DEFECTO;
    const ficha = await deps.catalogoRepository.obtenerFicha(productoId, zona);
    if (!ficha) throw new ErrorAplicacion(404, "PRODUCTO_NO_ENCONTRADO", "El producto no existe o no esta publicado");

    const proveedorIds = [...new Set(ficha.ofertas.map((o) => o.proveedor.id))];
    const resumen = proveedorIds.length ? await deps.calificacionRepository.resumenPorProveedor(proveedorIds) : [];
    const calificacionDe = (id: number) => {
      const r = resumen.find((x) => x.proveedorId === id);
      return { promedio: r?.promedio ?? null, cantidad: r?.cantidad ?? 0 };
    };

    const ofertas = ficha.ofertas
      .map((o) => ({
        ...o,
        precioNormalizado: precioNormalizado(o.precioUnitario, ficha.contenido, ficha.unidad),
        proveedor: { ...o.proveedor, calificacion: calificacionDe(o.proveedor.id) }
      }))
      .sort((a, b) => a.precioUnitario - b.precioUnitario || (a.precioNormalizado?.valor ?? 0) - (b.precioNormalizado?.valor ?? 0));
    return { ...ficha, ofertas };
  };
}
