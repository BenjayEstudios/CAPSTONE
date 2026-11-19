import {
  cambiarEstadoEnvioSchema,
  listarOrdenesQuerySchema,
  ORDEN_ENVIO_ESTADOS,
  ORDEN_ESTADOS,
  type AlcanceOrdenes,
  type EntregadoProveedor,
  type OrdenCompleta,
  type OrdenEnvio,
  type OrdenEnvioEstado,
  type OrdenEstado,
  type OrdenRepository,
  type PlanCambioEnvio,
  type UsuarioConContexto,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { cumpleRequisito } from "./verificar-permisos.use-case.js";

interface Deps {
  ordenRepository: OrdenRepository;
  usuarioRepository: UsuarioRepository;
  ahora?: () => Date;
}

async function contexto(deps: Deps, usuarioId: number): Promise<UsuarioConContexto> {
  const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
  if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
  return ctx;
}

// Alcance segun perfil: ver_todas_ordenes -> todas; proveedor -> sus envios; cliente -> sus ordenes.
export function resolverAlcance(ctx: UsuarioConContexto): AlcanceOrdenes {
  const p = ctx.rol.permisos;
  if (cumpleRequisito(p, { codigo: "ver_todas_ordenes" })) return { tipo: "todas" };
  if (cumpleRequisito(p, { codigo: "ver_ordenes_propias" })) {
    if (ctx.organizacion.tipo === "proveedor") return { tipo: "proveedor", proveedorId: ctx.organizacion.id };
    if (ctx.organizacion.tipo === "cliente") return { tipo: "cliente", usuarioId: ctx.usuario.id };
  }
  throw new ErrorAplicacion(403, "FORBIDDEN", "No tienes permiso para esto");
}

// Que ve cada perfil: la comision es interna (el cliente no la ve) y el proveedor solo ve
// los montos de su propio tramo, nunca los totales de la orden ni los envios de otros proveedores.
function presentar(a: AlcanceOrdenes, oc: OrdenCompleta, conLineas: boolean) {
  const { orden } = oc;
  const envios = oc.envios.map((e) => ({
    id: e.id,
    proveedorId: e.proveedorId,
    proveedorNombre: e.proveedorNombre,
    modalidad: e.modalidad,
    puntoRetiroId: e.puntoRetiroId,
    plazoHoras: e.plazoHoras,
    costoDespacho: e.costoDespacho,
    subtotal: e.subtotal,
    comisionPct: a.tipo === "cliente" ? null : e.comisionPct,
    comisionMonto: a.tipo === "cliente" ? null : e.comisionMonto,
    // Aditivo (KAN-119): monto del envio y neto a liquidar al proveedor (monto - comision). Oculto al cliente.
    montoEnvio: e.subtotal + (e.costoDespacho ?? 0),
    montoALiquidar: a.tipo === "cliente" ? null : e.subtotal + (e.costoDespacho ?? 0) - e.comisionMonto,
    estado: e.estado,
    actualizadoEn: e.actualizadoEn,
    ...(conLineas ? { lineas: e.lineas } : {})
  }));
  const propio = a.tipo === "proveedor" ? oc.envios[0] : undefined;
  return {
    id: orden.id,
    codigo: orden.codigo,
    estado: orden.estado,
    estadoPago: orden.estadoPago,
    creadaEn: orden.creadaEn,
    pagadoEn: orden.pagadoEn,
    requiereFactura: orden.requiereFactura,
    medioPago: orden.medioPago,
    comuna: oc.direccionEntrega?.comunaNombre ?? null,
    cliente: a.tipo === "cliente" ? undefined : { nombre: oc.clienteNombre, organizacion: oc.organizacionNombre },
    subtotal: propio ? propio.subtotal : orden.subtotal,
    costoDespachoTotal: propio ? (propio.costoDespacho ?? 0) : orden.costoDespachoTotal,
    comisionTotal: a.tipo === "cliente" ? null : propio ? propio.comisionMonto : orden.comisionTotal,
    total: propio ? propio.subtotal + (propio.costoDespacho ?? 0) : orden.total,
    // Aditivo (KAN-119): suma de los netos de los envios no cancelados visibles para el perfil. Null para el cliente.
    montoALiquidarTotal:
      a.tipo === "cliente"
        ? null
        : envios.filter((e) => e.estado !== "cancelado").reduce((t, e) => t + (e.montoALiquidar ?? 0), 0),
    ...(conLineas ? { direccionEntrega: oc.direccionEntrega } : {}),
    envios
  };
}

export function listarOrdenes(deps: Deps) {
  return async (usuarioId: number, input: unknown) => {
    const alcance = resolverAlcance(await contexto(deps, usuarioId));
    const f = validar(listarOrdenesQuerySchema, input);
    if (f.estado !== undefined) {
      const validos: readonly string[] = alcance.tipo === "proveedor" ? ORDEN_ENVIO_ESTADOS : ORDEN_ESTADOS;
      if (!validos.includes(f.estado)) {
        throw new ErrorAplicacion(400, "VALIDACION", `estado: debe ser uno de ${validos.join(", ")}`);
      }
    }
    const { items, total } = await deps.ordenRepository.listar({ alcance, estado: f.estado, pagina: f.pagina, tamano: f.tamano });
    return {
      items: items.map((i) => presentar(alcance, i, false)),
      pagina: f.pagina,
      tamano: f.tamano,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / f.tamano))
    };
  };
}

export function obtenerOrden(deps: Deps) {
  return async (usuarioId: number, id: number) => {
    const alcance = resolverAlcance(await contexto(deps, usuarioId));
    const oc = await deps.ordenRepository.buscarPorId(id, alcance);
    if (!oc) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", "Orden no encontrada");
    return presentar(alcance, oc, true);
  };
}

// Maquina de estados del envio (DBML solo define el enum; las transiciones son supuesto del equipo):
//   despacho: por_despachar -> en_preparacion -> despachado -> entregado
//   retiro:   por_despachar -> en_preparacion -> listo_retiro -> entregado
//   cancelado: solo desde por_despachar o en_preparacion. entregado y cancelado son finales.
export function transicionesPermitidas(modalidad: OrdenEnvio["modalidad"], desde: OrdenEnvioEstado): OrdenEnvioEstado[] {
  switch (desde) {
    case "por_despachar":
      return ["en_preparacion", "cancelado"];
    case "en_preparacion":
      return [modalidad === "despacho" ? "despachado" : "listo_retiro", "cancelado"];
    case "despachado":
    case "listo_retiro":
      return ["entregado"];
    default:
      return [];
  }
}

// Estado de la orden derivado de sus envios no cancelados. null = sin envios activos (no se toca).
export function estadoOrdenDesdeEnvios(estados: OrdenEnvioEstado[]): OrdenEstado | null {
  const activos = estados.filter((e) => e !== "cancelado");
  if (activos.length === 0) return null;
  if (activos.every((e) => e === "entregado")) return "entregada";
  if (activos.some((e) => e === "despachado" || e === "listo_retiro" || e === "entregado")) return "despachada";
  if (activos.some((e) => e === "en_preparacion")) return "en_preparacion";
  return "pagada";
}

/**
 * entregas_a_tiempo_pct del proveedor = 100 * (entregas con (fin - inicio) <= plazo_horas) / (entregas con plazo_horas),
 * redondeado a 2 decimales. inicio = orden.pagado_en (o creada_en si no hay), fin = momento de la entrega.
 * Las entregas sin plazo prometido no cuentan. null si ninguna tiene plazo.
 */
export function porcentajeATiempo(entregas: EntregadoProveedor[]): number | null {
  const conPlazo = entregas.filter((e) => e.plazoHoras !== null);
  if (conPlazo.length === 0) return null;
  const aTiempo = conPlazo.filter((e) => e.fin.getTime() - e.inicio.getTime() <= (e.plazoHoras as number) * 3_600_000).length;
  return Math.round((aTiempo / conPlazo.length) * 10000) / 100;
}

export function cambiarEstadoEnvio(deps: Deps) {
  return async (usuarioId: number, envioId: number, input: unknown) => {
    const ctx = await contexto(deps, usuarioId);
    const esAdmin = cumpleRequisito(ctx.rol.permisos, { codigo: "ver_todas_ordenes", minimo: "total" });
    const esProveedor = ctx.organizacion.tipo === "proveedor" && cumpleRequisito(ctx.rol.permisos, { codigo: "ver_ordenes_propias" });
    if (!esAdmin && !esProveedor) throw new ErrorAplicacion(403, "FORBIDDEN", "No tienes permiso para esto");
    const dto = validar(cambiarEstadoEnvioSchema, input);

    const envio = await deps.ordenRepository.buscarEnvio(envioId);
    // Para un proveedor, un envio ajeno es indistinguible de uno inexistente.
    if (!envio || (!esAdmin && envio.proveedorId !== ctx.organizacion.id)) {
      throw new ErrorAplicacion(404, "ENVIO_NO_ENCONTRADO", "Envio no encontrado");
    }

    let resultado: { estado: OrdenEnvioEstado; ordenEstado: OrdenEstado } | undefined;
    await deps.ordenRepository.cambiarEstadoEnvio(envioId, async (c): Promise<PlanCambioEnvio> => {
      if (c.orden.estado === "pendiente_pago") {
        throw new ErrorAplicacion(409, "ORDEN_NO_PAGADA", "La orden aun no esta pagada");
      }
      if (c.orden.estado === "reembolsada") throw new ErrorAplicacion(409, "ORDEN_REEMBOLSADA", "La orden fue reembolsada");
      if (!transicionesPermitidas(c.envio.modalidad, c.envio.estado).includes(dto.estado)) {
        throw new ErrorAplicacion(409, "TRANSICION_INVALIDA", `No se puede pasar un envio de ${c.envio.estado} a ${dto.estado}`, {
          desde: c.envio.estado,
          hacia: dto.estado,
          permitidas: transicionesPermitidas(c.envio.modalidad, c.envio.estado)
        });
      }
      const estados = c.hermanos.map((h) => (h.id === c.envio.id ? dto.estado : h.estado));
      const estadoOrden = estadoOrdenDesdeEnvios(estados) ?? c.orden.estado;

      let pct: number | null = null;
      if (dto.estado === "entregado") {
        const previos = await c.entregadosProveedor();
        pct = porcentajeATiempo([
          ...previos,
          { inicio: c.orden.pagadoEn ?? c.orden.creadaEn, fin: (deps.ahora ?? (() => new Date()))(), plazoHoras: c.envio.plazoHoras }
        ]);
      }
      const auditoria: PlanCambioEnvio["auditoria"] = [
        {
          usuarioId,
          entidad: "orden_envio",
          entidadId: c.envio.id,
          accion: "editar",
          datosAntes: { estado: c.envio.estado },
          datosDespues: { operacion: "cambiar_estado_envio", estado: dto.estado, ordenId: c.orden.id, entregasATiempoPct: pct }
        }
      ];
      if (estadoOrden !== c.orden.estado) {
        auditoria.push({
          usuarioId,
          entidad: "orden",
          entidadId: c.orden.id,
          accion: "editar",
          datosAntes: { estado: c.orden.estado },
          datosDespues: { operacion: "recalcular_estado_orden", estado: estadoOrden, envioId: c.envio.id }
        });
      }
      resultado = { estado: dto.estado, ordenEstado: estadoOrden };
      return { estadoEnvio: dto.estado, estadoOrden, entregasATiempoPct: pct, auditoria };
    });
    return { id: envioId, ordenId: envio.ordenId, ...(resultado as NonNullable<typeof resultado>) };
  };
}
