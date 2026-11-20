import {
  actualizarOfertaSchema,
  crearOfertaSchema,
  idParamSchema,
  listarMisOfertasQuerySchema,
  productosDisponiblesQuerySchema,
  type ModeracionRepository,
  type OfertaProveedorDto,
  type OfertaRepository,
  type ProductoParaOfertar,
  type ResultadoOfertaDto,
  type RevisionPrecioDto,
  type UsuarioConContexto,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { abrirCasoModeracion } from "./moderacion.use-cases.js";

// Ofertas del proveedor (KAN-146). Todas las operaciones son sobre las
// ofertas de la organizacion del usuario de la sesion, que debe ser un
// proveedor. El permiso (publicar_precio_stock) lo exige la ruta.

export interface DepsOfertas {
  ofertaRepository: OfertaRepository;
  usuarioRepository: UsuarioRepository;
  moderacionRepository: ModeracionRepository;
}

const noEncontrada = () => new ErrorAplicacion(404, "OFERTA_NO_ENCONTRADA", "La oferta no existe");

async function proveedorDeSesion(deps: DepsOfertas, usuarioId: number): Promise<UsuarioConContexto> {
  const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
  if (!ctx || ctx.usuario.estado === "suspendido") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
  if (ctx.organizacion.tipo !== "proveedor") {
    throw new ErrorAplicacion(403, "SOLO_PROVEEDORES", "Solo un proveedor puede gestionar ofertas");
  }
  return ctx;
}

// Una oferta ajena responde 404, igual que una inexistente (no revela que existe).
async function miOferta(deps: DepsOfertas, ctx: UsuarioConContexto, id: number): Promise<OfertaProveedorDto> {
  const oferta = await deps.ofertaRepository.buscarPorId(id);
  if (!oferta || oferta.proveedorId !== ctx.organizacion.id) throw noEncontrada();
  return oferta;
}

function exigirOrganizacionActiva(ctx: UsuarioConContexto) {
  if (ctx.organizacion.estado !== "activa") {
    throw new ErrorAplicacion(409, "PROVEEDOR_NO_ACTIVO", "Tu empresa debe estar aprobada para publicar ofertas");
  }
}

/** Precio maximo permitido sin revision: referencia + tope %. null si el producto no define referencia o tope. */
export function precioMaximoSinRevision(p: Pick<ProductoParaOfertar, "precioReferencia" | "topeSobreReferenciaPct">): number | null {
  if (p.precioReferencia === null || p.topeSobreReferenciaPct === null) return null;
  return Math.floor((p.precioReferencia * (100 + p.topeSobreReferenciaPct)) / 100);
}

const clp = (n: number) => "$" + n.toLocaleString("es-CL");

// Tope de publicacion (KAN-102): una oferta PUBLICADA no puede quedar sobre
// referencia x (1 + tope%): 409 PRECIO_SOBRE_TOPE con el maximo. Un borrador o
// una pausada si puede (no se muestran al comprador); en ese caso se abre (o
// reutiliza) un caso precio_fuera_rango para que un administrador lo revise.
// Ver docs/decisiones/DECISIONES-CERRADAS.md.
function exigirBajoTope(producto: ProductoParaOfertar, precio: number) {
  const maximo = precioMaximoSinRevision(producto);
  if (maximo === null || precio <= maximo) return;
  throw new ErrorAplicacion(
    409,
    "PRECIO_SOBRE_TOPE",
    `El precio supera el tope de publicacion de la ficha (maximo ${clp(maximo)})`,
    { precioMaximo: maximo, precioReferencia: producto.precioReferencia, topePct: producto.topeSobreReferenciaPct }
  );
}

// Si el precio supera el tope (borrador o pausada), abre o reutiliza el caso de moderacion.
async function revisarTope(
  deps: DepsOfertas,
  producto: ProductoParaOfertar,
  ofertaId: number,
  precio: number,
  usuarioId: number
): Promise<RevisionPrecioDto | null> {
  const maximo = precioMaximoSinRevision(producto);
  if (maximo === null || precio <= maximo) return null;
  const { caso } = await abrirCasoModeracion({ moderacionRepository: deps.moderacionRepository })(
    "precio_fuera_rango",
    "oferta",
    ofertaId,
    `Precio ${clp(precio)} supera en mas de ${producto.topeSobreReferenciaPct}% la referencia de ${clp(producto.precioReferencia as number)} (${producto.nombre})`,
    usuarioId
  );
  return {
    casoId: caso.id,
    precioReferencia: producto.precioReferencia as number,
    topePct: producto.topeSobreReferenciaPct as number,
    precioMaximo: maximo
  };
}

// GET /ofertas: las del proveedor de la sesion, con filtro por estado o texto.
export function listarMisOfertas(deps: DepsOfertas) {
  return async (usuarioId: number, input: unknown) => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    const f = validar(listarMisOfertasQuerySchema, input);
    const { items, total } = await deps.ofertaRepository.listarDeProveedor(ctx.organizacion.id, f);
    return { items, total, pagina: f.pagina, tamano: f.tamano };
  };
}

// GET /ofertas/productos-disponibles: productos publicados a los que este
// proveedor todavia no les puso oferta (pantalla "Asignarme un producto").
export function listarProductosDisponibles(deps: DepsOfertas) {
  return async (usuarioId: number, input: unknown) => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    const f = validar(productosDisponiblesQuerySchema, input);
    const { items, total } = await deps.ofertaRepository.productosDisponibles(ctx.organizacion.id, f);
    return { items, total, pagina: f.pagina, tamano: f.tamano };
  };
}

export function obtenerMiOferta(deps: DepsOfertas) {
  return async (usuarioId: number, params: unknown): Promise<OfertaProveedorDto> => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    return miOferta(deps, ctx, validar(idParamSchema, params).id);
  };
}

// POST /ofertas: una por producto x proveedor (409 si ya existe).
export function crearOferta(deps: DepsOfertas) {
  return async (usuarioId: number, input: unknown): Promise<ResultadoOfertaDto> => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    const d = validar(crearOfertaSchema, input);
    if (d.estado === "publicada") exigirOrganizacionActiva(ctx);

    const producto = await deps.ofertaRepository.productoParaOfertar(d.productoId);
    if (!producto || producto.estado !== "publicado") {
      throw new ErrorAplicacion(400, "PRODUCTO_NO_DISPONIBLE", "El producto no existe o no esta publicado en el catalogo");
    }
    if (d.estado === "publicada") exigirBajoTope(producto, d.precioUnitario);
    if (await deps.ofertaRepository.buscarPorProductoYProveedor(d.productoId, ctx.organizacion.id)) {
      throw new ErrorAplicacion(409, "OFERTA_DUPLICADA", "Ya tienes una oferta para este producto: editala en vez de crear otra");
    }

    const oferta = await deps.ofertaRepository.crear(
      {
        productoId: d.productoId,
        proveedorId: ctx.organizacion.id,
        precioUnitario: d.precioUnitario,
        unidadesPorCaja: d.unidadesPorCaja ?? null,
        cajasDisponibles: d.cajasDisponibles ?? null,
        minimoCompra: d.minimoCompra ?? null,
        plazoHoras: d.plazoHoras ?? null,
        modalidadEntrega: d.modalidadEntrega,
        notasCliente: d.notasCliente ?? null,
        estado: d.estado
      },
      {
        precioAnterior: null,
        precioNuevo: d.precioUnitario,
        cajasAnteriores: null,
        cajasNuevas: d.cajasDisponibles ?? null,
        motivo: "Creacion de la oferta",
        cambiadoPor: usuarioId
      }
    );
    const revisionPrecio = await revisarTope(deps, producto, oferta.id, oferta.precioUnitario, usuarioId);
    return { oferta, revisionPrecio };
  };
}

// PATCH /ofertas/:id. Estados: borrador -> publicada <-> pausada (una oferta
// publicada no vuelve a borrador). Cambio de precio o de cajas -> historial.
export function actualizarOferta(deps: DepsOfertas) {
  return async (usuarioId: number, params: unknown, input: unknown): Promise<ResultadoOfertaDto> => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    const antes = await miOferta(deps, ctx, validar(idParamSchema, params).id);
    const { motivo, ...c } = validar(actualizarOfertaSchema, input);
    if (c.estado === "publicada") exigirOrganizacionActiva(ctx);

    const cambiaPrecio = c.precioUnitario !== undefined && c.precioUnitario !== antes.precioUnitario;
    const estadoFinal = c.estado ?? antes.estado;
    // Publicar o cambiar el precio de una publicada: no puede quedar sobre el tope.
    const producto = cambiaPrecio || c.estado === "publicada" ? await deps.ofertaRepository.productoParaOfertar(antes.productoId) : null;
    if (producto && estadoFinal === "publicada") exigirBajoTope(producto, c.precioUnitario ?? antes.precioUnitario);
    const cambiaCajas = c.cajasDisponibles !== undefined && c.cajasDisponibles !== antes.cajasDisponibles;
    const historial =
      cambiaPrecio || cambiaCajas
        ? {
            precioAnterior: antes.precioUnitario,
            precioNuevo: c.precioUnitario ?? antes.precioUnitario,
            cajasAnteriores: antes.cajasDisponibles,
            cajasNuevas: c.cajasDisponibles === undefined ? antes.cajasDisponibles : c.cajasDisponibles,
            motivo: motivo ?? null,
            cambiadoPor: usuarioId
          }
        : null;

    const cambios = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined));
    const oferta = await deps.ofertaRepository.actualizar(antes.id, cambios, historial);

    let revisionPrecio: RevisionPrecioDto | null = null;
    if (cambiaPrecio && producto) revisionPrecio = await revisarTope(deps, producto, oferta.id, oferta.precioUnitario, usuarioId);
    return { oferta, revisionPrecio };
  };
}

// DELETE /ofertas/:id: solo borradores sin ventas. Una oferta que ya se
// publico se pausa, para no perder su historial ni las ordenes que la citan.
export function eliminarOferta(deps: DepsOfertas) {
  return async (usuarioId: number, params: unknown): Promise<void> => {
    const ctx = await proveedorDeSesion(deps, usuarioId);
    const oferta = await miOferta(deps, ctx, validar(idParamSchema, params).id);
    if (oferta.estado !== "borrador" || (await deps.ofertaRepository.tieneVentas(oferta.id))) {
      throw new ErrorAplicacion(409, "OFERTA_NO_ELIMINABLE", "Solo se puede eliminar un borrador: una oferta ya publicada se pausa");
    }
    await deps.ofertaRepository.eliminar(oferta.id);
  };
}
