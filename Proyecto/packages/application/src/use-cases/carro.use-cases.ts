import {
  confirmarCarroSchema,
  reemplazarCarroSchema,
  type CarroItem,
  type CarroRepository,
  type ConfirmarCarroDto,
  type ContextoCheckout,
  type EnvioPlan,
  type OfertaCarro,
  type PlanOrden,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

interface Deps {
  carroRepository: CarroRepository;
  usuarioRepository: UsuarioRepository;
}

// El carro y la compra son de usuarios de organizaciones tipo cliente.
async function exigirCliente(deps: Deps, usuarioId: number) {
  const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
  if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
  if (ctx.organizacion.tipo !== "cliente") {
    throw new ErrorAplicacion(403, "FORBIDDEN", "Solo los usuarios cliente tienen carro de compras");
  }
  return ctx;
}

function detalleItems(items: CarroItem[], ofertas: OfertaCarro[]) {
  const porId = new Map(ofertas.map((o) => [o.id, o]));
  return items.map((i) => {
    const o = porId.get(i.ofertaId);
    return {
      ofertaId: i.ofertaId,
      cantidad: i.cantidad,
      precioVisto: i.precioVisto,
      precioActual: o?.precioUnitario ?? null,
      productoId: o?.productoId ?? null,
      nombreProducto: o?.productoNombre ?? null,
      formato: o?.formato ?? null,
      proveedorId: o?.proveedorId ?? null,
      disponible: !!o && o.ofertaPublicada && o.productoPublicado,
      cajasDisponibles: o?.cajasDisponibles ?? null
    };
  });
}

export function obtenerCarro(deps: Deps) {
  return async (usuarioId: number) => {
    await exigirCliente(deps, usuarioId);
    const carro = await deps.carroRepository.obtenerAbierto(usuarioId);
    const items = carro?.items ?? [];
    const ofertas = items.length ? await deps.carroRepository.ofertasPorIds(items.map((i) => i.ofertaId)) : [];
    return { id: carro?.id ?? null, estado: "abierto" as const, actualizadoEn: carro?.actualizadoEn ?? null, items: detalleItems(items, ofertas) };
  };
}

// PUT /carro: reemplaza los items validando que cada oferta exista y este publicada.
export function reemplazarCarro(deps: Deps) {
  return async (usuarioId: number, input: unknown) => {
    await exigirCliente(deps, usuarioId);
    const dto = validar(reemplazarCarroSchema, input);
    const ids = dto.items.map((i) => i.ofertaId);
    if (new Set(ids).size !== ids.length) {
      throw new ErrorAplicacion(400, "ITEM_DUPLICADO", "Una oferta no puede repetirse en el carro");
    }
    const ofertas = ids.length ? await deps.carroRepository.ofertasPorIds(ids) : [];
    const porId = new Map(ofertas.map((o) => [o.id, o]));
    const inexistentes = ids.filter((id) => !porId.has(id));
    if (inexistentes.length) {
      throw new ErrorAplicacion(404, "OFERTA_NO_ENCONTRADA", `Ofertas inexistentes: ${inexistentes.join(", ")}`, { ofertaIds: inexistentes });
    }
    const noDisponibles = ofertas.filter((o) => !o.ofertaPublicada || !o.productoPublicado).map((o) => o.id);
    if (noDisponibles.length) {
      throw new ErrorAplicacion(409, "OFERTA_NO_DISPONIBLE", `Ofertas no publicadas: ${noDisponibles.join(", ")}`, { ofertaIds: noDisponibles });
    }
    const carro = await deps.carroRepository.guardarItems(usuarioId, dto.items);
    return { id: carro.id, estado: carro.estado, actualizadoEn: carro.actualizadoEn, items: detalleItems(carro.items, ofertas) };
  };
}

const maxNullable = (xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.max(...v) : null;
};

/**
 * Funcion pura que arma el plan de la orden desde el contexto bloqueado. Reglas:
 * - Orden de validacion: carro vacio, oferta no publicada, precio distinto al visto (el cliente decide),
 *   minimo de compra, stock, proveedor, modalidad/retiro, direccion y cobertura.
 * - Una orden_envio por proveedor. Despacho: cobertura por comuna (prioritaria) o por region (comuna NULL);
 *   gratis si subtotal del tramo >= organizacion.despacho_gratis_desde. Retiro: costo 0.
 * - plazo_horas del envio = max(plazo de sus ofertas, plazo de la cobertura).
 * - comision por proveedor = round(subtotal * comision_pct / 100); pct NULL = 0.
 * - total = subtotal + despacho (la comision se descuenta al proveedor al liquidar, no se cobra al cliente).
 * - cantidad se expresa en cajas (misma unidad que cajas_disponibles); precio_unitario es el precio por caja.
 */
export function planificarOrden(ctx: ContextoCheckout, dto: ConfirmarCarroDto): PlanOrden {
  const items = ctx.carro?.items ?? [];
  if (items.length === 0) throw new ErrorAplicacion(409, "CARRO_VACIO", "El carro esta vacio");
  if (dto.direccionId !== undefined && dto.direccion !== undefined) {
    throw new ErrorAplicacion(400, "VALIDACION", "Indica direccionId o direccion, no ambos");
  }
  const ofertas = new Map(ctx.ofertas.map((o) => [o.id, o]));

  const noDisponibles = items
    .filter((i) => {
      const o = ofertas.get(i.ofertaId);
      return !o || !o.ofertaPublicada || !o.productoPublicado;
    })
    .map((i) => ({ ofertaId: i.ofertaId }));
  if (noDisponibles.length) {
    throw new ErrorAplicacion(409, "OFERTA_NO_DISPONIBLE", "Hay ofertas que ya no estan publicadas", { lineas: noDisponibles });
  }
  const cambios = items
    .filter((i) => ofertas.get(i.ofertaId)!.precioUnitario !== i.precioVisto)
    .map((i) => ({ ofertaId: i.ofertaId, precioVisto: i.precioVisto, precioActual: ofertas.get(i.ofertaId)!.precioUnitario }));
  if (cambios.length) throw new ErrorAplicacion(409, "PRECIO_CAMBIO", "El precio de algunas ofertas cambio", { lineas: cambios });

  const bajoMinimo = items
    .filter((i) => {
      const o = ofertas.get(i.ofertaId)!;
      return o.minimoCompra !== null && i.cantidad * (o.unidadesPorCaja ?? 1) < o.minimoCompra;
    })
    .map((i) => ({ ofertaId: i.ofertaId, cantidad: i.cantidad, minimoCompra: ofertas.get(i.ofertaId)!.minimoCompra }));
  if (bajoMinimo.length) throw new ErrorAplicacion(409, "MINIMO_COMPRA", "Hay lineas bajo el minimo de compra", { lineas: bajoMinimo });

  const sinStock = items
    .filter((i) => {
      const d = ofertas.get(i.ofertaId)!.cajasDisponibles;
      return d !== null && i.cantidad > d;
    })
    .map((i) => ({ ofertaId: i.ofertaId, solicitado: i.cantidad, disponible: ofertas.get(i.ofertaId)!.cajasDisponibles }));
  if (sinStock.length) throw new ErrorAplicacion(409, "SIN_STOCK", "Stock insuficiente en algunas lineas", { lineas: sinStock });

  // Agrupa por proveedor respetando el orden de aparicion en el carro.
  const grupos = new Map<number, CarroItem[]>();
  for (const i of items) {
    const pid = ofertas.get(i.ofertaId)!.proveedorId;
    grupos.set(pid, [...(grupos.get(pid) ?? []), i]);
  }
  const retiros = new Map(dto.retiros.map((r) => [r.proveedorId, r.puntoRetiroId]));
  const proveedores = new Map(ctx.proveedores.map((p) => [p.id, p]));
  const necesitaDespacho = [...grupos.keys()].some((pid) => !retiros.has(pid));
  if (necesitaDespacho && !ctx.comunaDestino) {
    throw new ErrorAplicacion(400, "DIRECCION_REQUERIDA", "Indica una direccion de despacho valida (direccionId o direccion con comunaId existente)");
  }

  const envios: EnvioPlan[] = [];
  const sinCobertura: Array<{ proveedorId: number }> = [];
  for (const [pid, its] of grupos) {
    const prov = proveedores.get(pid);
    if (!prov || !prov.activo) {
      throw new ErrorAplicacion(409, "PROVEEDOR_NO_DISPONIBLE", `El proveedor ${pid} no esta activo`, { proveedorId: pid });
    }
    const ofs = its.map((i) => ofertas.get(i.ofertaId)!);
    const lineas = its.map((i, k) => ({
      ofertaId: i.ofertaId,
      productoId: ofs[k].productoId,
      nombreProducto: ofs[k].productoNombre,
      formato: ofs[k].formato,
      precioUnitario: ofs[k].precioUnitario,
      cantidad: i.cantidad,
      totalLinea: ofs[k].precioUnitario * i.cantidad
    }));
    const subtotal = lineas.reduce((s, l) => s + l.totalLinea, 0);
    const comisionPct = prov.comisionPct ?? 0;
    const comisionMonto = Math.round((subtotal * comisionPct) / 100);
    const plazoOfertas = maxNullable(ofs.map((o) => o.plazoHoras));

    const puntoId = retiros.get(pid);
    if (puntoId !== undefined) {
      const punto = ctx.puntosRetiro.find((p) => p.id === puntoId && p.proveedorId === pid && p.activo);
      if (!punto || !prov.ofreceRetiro || ofs.some((o) => o.modalidadEntrega === "despacho")) {
        throw new ErrorAplicacion(409, "RETIRO_NO_DISPONIBLE", `El proveedor ${pid} no permite retiro para este pedido`, { proveedorId: pid, puntoRetiroId: puntoId });
      }
      envios.push({ proveedorId: pid, modalidad: "retiro", puntoRetiroId: puntoId, plazoHoras: plazoOfertas, costoDespacho: 0, subtotal, comisionPct, comisionMonto, lineas });
      continue;
    }
    if (!prov.ofreceDespacho || ofs.some((o) => o.modalidadEntrega === "retiro")) {
      throw new ErrorAplicacion(409, "MODALIDAD_NO_DISPONIBLE", `El proveedor ${pid} no despacha este pedido; elige retiro`, { proveedorId: pid });
    }
    const dest = ctx.comunaDestino!;
    const cob =
      prov.coberturas.find((c) => c.comunaId === dest.id) ??
      prov.coberturas.find((c) => c.comunaId === null && c.regionCodigo === dest.regionCodigo);
    if (!cob) {
      sinCobertura.push({ proveedorId: pid });
      continue;
    }
    const gratis = prov.despachoGratisDesde !== null && subtotal >= prov.despachoGratisDesde;
    envios.push({
      proveedorId: pid,
      modalidad: "despacho",
      puntoRetiroId: null,
      plazoHoras: maxNullable([plazoOfertas, cob.plazoHoras]),
      costoDespacho: gratis ? 0 : cob.costoDespacho,
      subtotal,
      comisionPct,
      comisionMonto,
      lineas
    });
  }
  if (sinCobertura.length) {
    throw new ErrorAplicacion(409, "SIN_COBERTURA", "Algun proveedor no despacha a la direccion indicada", { proveedores: sinCobertura });
  }

  const subtotal = envios.reduce((s, e) => s + e.subtotal, 0);
  const costoDespachoTotal = envios.reduce((s, e) => s + e.costoDespacho, 0);
  return {
    subtotal,
    costoDespachoTotal,
    comisionTotal: envios.reduce((s, e) => s + e.comisionMonto, 0),
    total: subtotal + costoDespachoTotal,
    requiereFactura: dto.requiereFactura,
    envios,
    stock: items
      .filter((i) => ofertas.get(i.ofertaId)!.cajasDisponibles !== null)
      .map((i) => {
        const antes = ofertas.get(i.ofertaId)!.cajasDisponibles as number;
        return { ofertaId: i.ofertaId, cajasAnteriores: antes, cajasNuevas: antes - i.cantidad };
      })
  };
}

export function confirmarCarro(deps: Deps) {
  return async (usuarioId: number, input: unknown) => {
    const u = await exigirCliente(deps, usuarioId);
    const dto = validar(confirmarCarroSchema, input ?? {});
    let plan: PlanOrden | undefined;
    const creada = await deps.carroRepository.confirmar(
      usuarioId,
      u.usuario.organizacionId,
      { direccionId: dto.direccionId, direccionNueva: dto.direccion },
      (ctx) => (plan = planificarOrden(ctx, dto)),
      (ordenId, plan) => ({
        usuarioId,
        entidad: "orden",
        entidadId: ordenId,
        accion: "crear",
        datosAntes: null,
        datosDespues: {
          operacion: "crear_orden",
          subtotal: plan.subtotal,
          costoDespachoTotal: plan.costoDespachoTotal,
          total: plan.total,
          envios: plan.envios.map((e) => ({ proveedorId: e.proveedorId, modalidad: e.modalidad, subtotal: e.subtotal }))
        }
      })
    );
    const p = plan as PlanOrden;
    return {
      ...creada,
      estado: "pendiente_pago" as const,
      subtotal: p.subtotal,
      costoDespachoTotal: p.costoDespachoTotal,
      total: p.total,
      envios: p.envios.map((e) => ({ proveedorId: e.proveedorId, modalidad: e.modalidad, plazoHoras: e.plazoHoras, costoDespacho: e.costoDespacho, subtotal: e.subtotal, lineas: e.lineas }))
    };
  };
}
