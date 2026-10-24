import { describe, expect, it } from "vitest";
import type {
  Carro,
  CarroRepository,
  ContextoCheckout,
  OfertaCarro,
  Orden,
  OrdenEnvio,
  OrdenRepository,
  PlanCambioEnvio,
  ProveedorCheckout,
  UsuarioConContexto,
  UsuarioRepository
} from "@cotizapp/domain";
import { confirmarCarro, planificarOrden, reemplazarCarro } from "./carro.use-cases.js";
import {
  cambiarEstadoEnvio,
  estadoOrdenDesdeEnvios,
  listarOrdenes,
  obtenerOrden,
  porcentajeATiempo,
  transicionesPermitidas
} from "./ordenes.use-cases.js";

const falla = (p: Promise<unknown> | (() => unknown)) =>
  (typeof p === "function" ? Promise.resolve().then(p) : p).then(
    () => null,
    (e: unknown) => e as { statusCode: number; code: string; detalle?: any }
  );

const oferta = (id: number, proveedorId: number, precio: number, extra: Partial<OfertaCarro> = {}): OfertaCarro => ({
  id, productoId: id * 10, proveedorId, productoNombre: `Prod ${id}`, formato: "Saco", productoPublicado: true, ofertaPublicada: true,
  precioUnitario: precio, cajasDisponibles: 100, unidadesPorCaja: 1, minimoCompra: null, plazoHoras: 48, modalidadEntrega: "ambos", ...extra
});
const prov = (id: number, extra: Partial<ProveedorCheckout> = {}): ProveedorCheckout => ({
  id, razonSocial: `P${id}`, activo: true, comisionPct: 10, despachoGratisDesde: null, ofreceDespacho: true, ofreceRetiro: true,
  plazoEstandarHoras: 48, coberturas: [{ comunaId: null, regionCodigo: "RM", costoDespacho: 3000, plazoHoras: 72 }], ...extra
});
const carro = (items: Array<[number, number, number]>): Carro => ({
  id: 1, usuarioId: 5, estado: "abierto", actualizadoEn: new Date(),
  items: items.map(([ofertaId, cantidad, precioVisto]) => ({ ofertaId, cantidad, precioVisto }))
});
const ctx = (c: Carro | null, extra: Partial<ContextoCheckout> = {}): ContextoCheckout => ({
  carro: c,
  ofertas: [oferta(1, 2, 1000), oferta(2, 2, 500), oferta(3, 3, 2000)],
  proveedores: [prov(2), prov(3, { comisionPct: null, coberturas: [{ comunaId: 7, regionCodigo: "RM", costoDespacho: 1500, plazoHoras: null }, { comunaId: null, regionCodigo: "RM", costoDespacho: 9999, plazoHoras: 96 }] })],
  puntosRetiro: [{ id: 50, proveedorId: 2, activo: true }],
  comunaDestino: { id: 7, regionCodigo: "RM" },
  ...extra
});
const dto = (extra = {}) => ({ retiros: [], requiereFactura: false, ...extra });

describe("planificarOrden", () => {
  it("separa por proveedor y calcula despacho, comision y totales", () => {
    const p = planificarOrden(ctx(carro([[1, 2, 1000], [2, 4, 500], [3, 1, 2000]])), dto());
    expect(p.envios.map((e) => e.proveedorId)).toEqual([2, 3]);
    const [a, b] = p.envios;
    expect(a).toMatchObject({ subtotal: 4000, costoDespacho: 3000, comisionPct: 10, comisionMonto: 400, plazoHoras: 72, modalidad: "despacho" });
    expect(a.lineas).toHaveLength(2);
    // cobertura por comuna gana a la de region; comision NULL = 0
    expect(b).toMatchObject({ subtotal: 2000, costoDespacho: 1500, comisionPct: 0, comisionMonto: 0, plazoHoras: 48 });
    expect(p).toMatchObject({ subtotal: 6000, costoDespachoTotal: 4500, comisionTotal: 400, total: 10500 });
    expect(p.stock).toEqual([
      { ofertaId: 1, cajasAnteriores: 100, cajasNuevas: 98 },
      { ofertaId: 2, cajasAnteriores: 100, cajasNuevas: 96 },
      { ofertaId: 3, cajasAnteriores: 100, cajasNuevas: 99 }
    ]);
  });
  it("despacho gratis sobre el umbral del proveedor", () => {
    const c = ctx(carro([[1, 2, 1000]]), { proveedores: [prov(2, { despachoGratisDesde: 2000 }), prov(3)] });
    expect(planificarOrden(c, dto()).envios[0].costoDespacho).toBe(0);
  });
  it("retiro: costo 0 y punto de retiro", () => {
    const p = planificarOrden(ctx(carro([[1, 1, 1000]])), dto({ retiros: [{ proveedorId: 2, puntoRetiroId: 50 }] }));
    expect(p.envios[0]).toMatchObject({ modalidad: "retiro", puntoRetiroId: 50, costoDespacho: 0 });
  });
  it("retiro invalido (punto ajeno u oferta solo despacho) -> 409", async () => {
    expect(await falla(() => planificarOrden(ctx(carro([[1, 1, 1000]])), dto({ retiros: [{ proveedorId: 2, puntoRetiroId: 99 }] })))).toMatchObject({ code: "RETIRO_NO_DISPONIBLE" });
    const c = ctx(carro([[1, 1, 1000]]), { ofertas: [oferta(1, 2, 1000, { modalidadEntrega: "despacho" })] });
    expect(await falla(() => planificarOrden(c, dto({ retiros: [{ proveedorId: 2, puntoRetiroId: 50 }] })))).toMatchObject({ code: "RETIRO_NO_DISPONIBLE" });
  });
  it("sin cobertura -> 409 SIN_COBERTURA", async () => {
    const c = ctx(carro([[1, 1, 1000]]), { comunaDestino: { id: 9, regionCodigo: "V" } });
    expect(await falla(() => planificarOrden(c, dto()))).toMatchObject({ statusCode: 409, code: "SIN_COBERTURA", detalle: { proveedores: [{ proveedorId: 2 }] } });
  });
  it("direccion obligatoria si hay despacho; ambas direcciones -> 400", async () => {
    expect(await falla(() => planificarOrden(ctx(carro([[1, 1, 1000]]), { comunaDestino: null }), dto()))).toMatchObject({ code: "DIRECCION_REQUERIDA" });
    expect(await falla(() => planificarOrden(ctx(carro([[1, 1, 1000]])), dto({ direccionId: 1, direccion: { comunaId: 1, calle: "x" } })))).toMatchObject({ statusCode: 400 });
  });
  it("stock insuficiente -> 409 SIN_STOCK con detalle por linea", async () => {
    const e = await falla(() => planificarOrden(ctx(carro([[1, 101, 1000], [2, 1, 500]])), dto()));
    expect(e).toMatchObject({ statusCode: 409, code: "SIN_STOCK", detalle: { lineas: [{ ofertaId: 1, solicitado: 101, disponible: 100 }] } });
  });
  it("oferta sin control de stock no se descuenta", () => {
    const c = ctx(carro([[1, 5, 1000]]), { ofertas: [oferta(1, 2, 1000, { cajasDisponibles: null })] });
    expect(planificarOrden(c, dto()).stock).toEqual([]);
  });
  it("precio distinto al visto -> 409 PRECIO_CAMBIO con lo que cambio", async () => {
    const e = await falla(() => planificarOrden(ctx(carro([[1, 1, 900]])), dto()));
    expect(e).toMatchObject({ statusCode: 409, code: "PRECIO_CAMBIO", detalle: { lineas: [{ ofertaId: 1, precioVisto: 900, precioActual: 1000 }] } });
  });
  it("oferta pausada -> 409 OFERTA_NO_DISPONIBLE; carro vacio -> CARRO_VACIO; minimo de compra", async () => {
    const c = ctx(carro([[1, 1, 1000]]), { ofertas: [oferta(1, 2, 1000, { ofertaPublicada: false })] });
    expect(await falla(() => planificarOrden(c, dto()))).toMatchObject({ code: "OFERTA_NO_DISPONIBLE" });
    expect(await falla(() => planificarOrden(ctx(null), dto()))).toMatchObject({ code: "CARRO_VACIO" });
    const m = ctx(carro([[1, 1, 1000]]), { ofertas: [oferta(1, 2, 1000, { minimoCompra: 5 })] });
    expect(await falla(() => planificarOrden(m, dto()))).toMatchObject({ code: "MINIMO_COMPRA" });
  });
});

// ---- repos en memoria ----
const usuarios: Record<number, UsuarioConContexto> = {
  5: { usuario: { id: 5, organizacionId: 4, estado: "activo" } as never, rol: { permisos: { ver_ordenes_propias: "total" } } as never, organizacion: { id: 4, tipo: "cliente", estado: "activa" } },
  6: { usuario: { id: 6, organizacionId: 4, estado: "activo" } as never, rol: { permisos: { ver_ordenes_propias: "total" } } as never, organizacion: { id: 4, tipo: "cliente", estado: "activa" } },
  3: { usuario: { id: 3, organizacionId: 2, estado: "activo" } as never, rol: { permisos: { ver_ordenes_propias: "total" } } as never, organizacion: { id: 2, tipo: "proveedor", estado: "activa" } },
  4: { usuario: { id: 4, organizacionId: 3, estado: "activo" } as never, rol: { permisos: { ver_ordenes_propias: "total" } } as never, organizacion: { id: 3, tipo: "proveedor", estado: "activa" } },
  1: { usuario: { id: 1, organizacionId: 1, estado: "activo" } as never, rol: { permisos: { ver_todas_ordenes: "total", ver_ordenes_propias: "total" } } as never, organizacion: { id: 1, tipo: "interna", estado: "activa" } },
  2: { usuario: { id: 2, organizacionId: 1, estado: "activo" } as never, rol: { permisos: { crear_producto: "total" } } as never, organizacion: { id: 1, tipo: "interna", estado: "activa" } }
};
const usuarioRepository = { buscarPorId: async (id: number) => usuarios[id] ?? null } as unknown as UsuarioRepository;

describe("carro y confirmacion", () => {
  function setup(c: Carro | null) {
    const estado = { carro: c, ordenes: [] as unknown[], auditoria: [] as unknown[] };
    const ofertas = [oferta(1, 2, 1000), oferta(2, 3, 500, { ofertaPublicada: false })];
    const carroRepository: CarroRepository = {
      obtenerAbierto: async () => estado.carro,
      guardarItems: async (usuarioId, items) => (estado.carro = { id: 1, usuarioId, estado: "abierto", items, actualizadoEn: new Date() }),
      ofertasPorIds: async (ids) => ofertas.filter((o) => ids.includes(o.id)),
      confirmar: async (_u, _o, _e, planificar, auditoria) => {
        const plan = planificar(ctx(estado.carro, { ofertas }));
        estado.ordenes.push(plan);
        estado.auditoria.push(auditoria(77, plan));
        estado.carro = { ...(estado.carro as Carro), estado: "convertido" };
        return { ordenId: 77, codigo: "CM-90077" };
      }
    };
    return { estado, deps: { carroRepository, usuarioRepository } };
  }
  it("PUT /carro valida existencia, publicacion y duplicados", async () => {
    const { deps } = setup(null);
    const put = reemplazarCarro(deps);
    expect(await falla(put(5, { items: [{ ofertaId: 1, cantidad: 1, precioVisto: 1000 }, { ofertaId: 1, cantidad: 2, precioVisto: 1000 }] }))).toMatchObject({ code: "ITEM_DUPLICADO" });
    expect(await falla(put(5, { items: [{ ofertaId: 99, cantidad: 1, precioVisto: 1 }] }))).toMatchObject({ statusCode: 404 });
    expect(await falla(put(5, { items: [{ ofertaId: 2, cantidad: 1, precioVisto: 500 }] }))).toMatchObject({ code: "OFERTA_NO_DISPONIBLE" });
    expect(await falla(put(5, { items: [{ ofertaId: 1, cantidad: 0, precioVisto: 1 }] }))).toMatchObject({ code: "VALIDACION" });
    const ok = await put(5, { items: [{ ofertaId: 1, cantidad: 2, precioVisto: 1000 }] });
    expect(ok.items[0]).toMatchObject({ ofertaId: 1, disponible: true, precioActual: 1000 });
  });
  it("solo clientes tienen carro", async () => {
    expect(await falla(reemplazarCarro(setup(null).deps)(3, { items: [] }))).toMatchObject({ statusCode: 403 });
  });
  it("confirma, devuelve codigo y totales, marca el carro convertido y audita", async () => {
    const s = setup(carro([[1, 3, 1000]]));
    const r = await confirmarCarro(s.deps)(5, { direccionId: 1 });
    expect(r).toMatchObject({ ordenId: 77, codigo: "CM-90077", estado: "pendiente_pago", subtotal: 3000, costoDespachoTotal: 3000, total: 6000 });
    expect(s.estado.carro?.estado).toBe("convertido");
    expect(s.estado.auditoria[0]).toMatchObject({ entidad: "orden", accion: "crear", entidadId: 77 });
  });
  it("falla de plan no persiste nada", async () => {
    const s = setup(carro([[1, 3, 999]]));
    expect(await falla(confirmarCarro(s.deps)(5, { direccionId: 1 }))).toMatchObject({ code: "PRECIO_CAMBIO" });
    expect(s.estado.ordenes).toHaveLength(0);
  });
});

// ---- ordenes ----
const envio = (id: number, proveedorId: number, estado: OrdenEnvio["estado"], extra: Partial<OrdenEnvio> = {}): OrdenEnvio => ({
  id, ordenId: 100, proveedorId, modalidad: "despacho", puntoRetiroId: null, direccionEntregaId: 1, plazoHoras: 48, costoDespacho: 1000,
  subtotal: 5000, comisionPct: "10.00", comisionMonto: 500, estado, liquidacionId: null, montoBrutoLiquidado: null,
  comisionLiquidada: null, montoNetoLiquidado: null, actualizadoEn: new Date(), ...extra
});
const ordenBase = (extra: Partial<Orden> = {}): Orden => ({
  id: 100, codigo: "CM-90100", usuarioId: 5, organizacionId: 4, direccionEntregaId: 1, subtotal: 10000, costoDespachoTotal: 2000,
  comisionTotal: 1000, total: 12000, requiereFactura: false, estado: "pagada", medioPago: null, estadoPago: "pagado",
  referenciaPasarela: null, creadaEn: new Date("2026-01-01T00:00:00Z"), pagadoEn: new Date("2026-01-01T00:00:00Z"), ...extra
});

function setupOrdenes(ordenExtra: Partial<Orden> = {}, envios = [envio(1, 2, "por_despachar"), envio(2, 3, "por_despachar")]) {
  const st = { orden: ordenBase(ordenExtra), envios, auditoria: [] as unknown[], pct: undefined as number | null | undefined, entregados: [] as never[] };
  const completa = (alcance: any) => ({
    orden: st.orden,
    envios: st.envios.filter((e) => alcance.tipo !== "proveedor" || e.proveedorId === alcance.proveedorId).map((e) => ({ ...e, proveedorNombre: `P${e.proveedorId}`, lineas: [] })),
    clienteNombre: "Cli", organizacionNombre: "OrgCli", direccionEntrega: null
  });
  const ordenRepository: OrdenRepository = {
    listar: async (f) => ({ items: [completa(f.alcance)].filter((c) => (f.alcance.tipo !== "cliente" || st.orden.usuarioId === f.alcance.usuarioId) && c.envios.length), total: 1 }),
    buscarPorId: async (id, a) => {
      const c = completa(a);
      if (id !== st.orden.id || (a.tipo === "cliente" && st.orden.usuarioId !== a.usuarioId) || c.envios.length === 0) return null;
      return c;
    },
    buscarEnvio: async (id) => st.envios.find((e) => e.id === id) ?? null,
    cambiarEstadoEnvio: async (id, planificar) => {
      const e = st.envios.find((x) => x.id === id)!;
      const plan: PlanCambioEnvio = await planificar({ envio: e, orden: st.orden, hermanos: st.envios, entregadosProveedor: async () => st.entregados });
      e.estado = plan.estadoEnvio;
      st.orden.estado = plan.estadoOrden;
      st.pct = plan.entregasATiempoPct;
      st.auditoria.push(...plan.auditoria);
    }
  };
  return { st, deps: { ordenRepository, usuarioRepository, ahora: () => new Date("2026-01-02T00:00:00Z") } };
}

describe("alcance por perfil", () => {
  it("cliente ve sus ordenes sin comision; otro cliente no ve la orden (404)", async () => {
    const { deps } = setupOrdenes();
    const l = await listarOrdenes(deps)(5, {});
    expect(l.items[0]).toMatchObject({ total: 12000, comisionTotal: null });
    expect(l.items[0].envios[0].comisionMonto).toBeNull();
    expect((await obtenerOrden(deps)(5, 100)).codigo).toBe("CM-90100");
    expect(await falla(obtenerOrden(deps)(6, 100))).toMatchObject({ statusCode: 404 });
  });
  it("proveedor ve solo su envio y sus montos, no el total de la orden", async () => {
    const { deps } = setupOrdenes();
    const o = await obtenerOrden(deps)(3, 100);
    expect(o.envios.map((e) => e.proveedorId)).toEqual([2]);
    expect(o).toMatchObject({ subtotal: 5000, costoDespachoTotal: 1000, total: 6000, comisionTotal: 500 });
  });
  it("KAN-119: admin ve medio de pago, comuna, comision y monto a liquidar; cliente no ve lo interno", async () => {
    const { deps, st } = setupOrdenes({ medioPago: "tarjeta" });
    const orig = deps.ordenRepository.buscarPorId;
    deps.ordenRepository.buscarPorId = async (id, a) => {
      const c = await orig(id, a);
      return c && { ...c, direccionEntrega: { calle: "x", numero: null, complemento: null, referencia: null, comunaNombre: "Providencia", regionNombre: "RM" } };
    };
    st.envios[1].estado = "cancelado";
    const a = await obtenerOrden(deps)(1, 100);
    expect(a).toMatchObject({ medioPago: "tarjeta", comuna: "Providencia", montoALiquidarTotal: 5500 });
    expect(a.envios[0]).toMatchObject({ montoEnvio: 6000, comisionMonto: 500, montoALiquidar: 5500 });
    const c = await obtenerOrden(deps)(5, 100);
    expect(c.montoALiquidarTotal).toBeNull();
    expect(c.envios[0].montoALiquidar).toBeNull();
    expect(c.envios[0].comisionMonto).toBeNull();
    const p = await obtenerOrden(deps)(3, 100);
    expect(p.montoALiquidarTotal).toBe(5500);
  });
  it("admin ve todos los envios; sin permisos de ordenes -> 403; filtro de estado validado", async () => {
    const { deps } = setupOrdenes();
    expect((await obtenerOrden(deps)(1, 100)).envios).toHaveLength(2);
    expect(await falla(listarOrdenes(deps)(2, {}))).toMatchObject({ statusCode: 403 });
    expect(await falla(listarOrdenes(deps)(3, { estado: "pagada" }))).toMatchObject({ code: "VALIDACION" });
    expect(await falla(listarOrdenes(deps)(5, { estado: "por_despachar" }))).toMatchObject({ code: "VALIDACION" });
  });
});

describe("maquina de estados del envio", () => {
  it("transiciones por modalidad", () => {
    expect(transicionesPermitidas("despacho", "en_preparacion")).toEqual(["despachado", "cancelado"]);
    expect(transicionesPermitidas("retiro", "en_preparacion")).toEqual(["listo_retiro", "cancelado"]);
    expect(transicionesPermitidas("despacho", "entregado")).toEqual([]);
  });
  it("estado de la orden segun envios", () => {
    expect(estadoOrdenDesdeEnvios(["por_despachar", "por_despachar"])).toBe("pagada");
    expect(estadoOrdenDesdeEnvios(["en_preparacion", "por_despachar"])).toBe("en_preparacion");
    expect(estadoOrdenDesdeEnvios(["despachado", "por_despachar"])).toBe("despachada");
    expect(estadoOrdenDesdeEnvios(["entregado", "cancelado"])).toBe("entregada");
    expect(estadoOrdenDesdeEnvios(["cancelado"])).toBeNull();
  });
  it("proveedor avanza su envio, audita y recalcula la orden", async () => {
    const { st, deps } = setupOrdenes();
    const r = await cambiarEstadoEnvio(deps)(3, 1, { estado: "en_preparacion" });
    expect(r).toMatchObject({ estado: "en_preparacion", ordenEstado: "en_preparacion" });
    expect(st.auditoria).toHaveLength(2);
  });
  it("transicion invalida -> 409; proveedor ajeno -> 404; cliente -> 403; orden sin pagar -> 409", async () => {
    const { deps } = setupOrdenes();
    expect(await falla(cambiarEstadoEnvio(deps)(3, 1, { estado: "entregado" }))).toMatchObject({ statusCode: 409, code: "TRANSICION_INVALIDA" });
    expect(await falla(cambiarEstadoEnvio(deps)(3, 2, { estado: "en_preparacion" }))).toMatchObject({ statusCode: 404 });
    expect(await falla(cambiarEstadoEnvio(deps)(5, 1, { estado: "en_preparacion" }))).toMatchObject({ statusCode: 403 });
    expect(await falla(cambiarEstadoEnvio(deps)(3, 99, { estado: "en_preparacion" }))).toMatchObject({ statusCode: 404 });
    expect(await falla(cambiarEstadoEnvio(deps)(3, 1, { estado: "volando" }))).toMatchObject({ code: "VALIDACION" });
    const sin = setupOrdenes({ estado: "pendiente_pago" });
    expect(await falla(cambiarEstadoEnvio(sin.deps)(3, 1, { estado: "en_preparacion" }))).toMatchObject({ code: "ORDEN_NO_PAGADA" });
  });
  it("admin mueve cualquier envio; al entregar recalcula entregas_a_tiempo_pct", async () => {
    const { st, deps } = setupOrdenes({}, [envio(1, 2, "despachado")]);
    st.entregados = [{ inicio: new Date("2026-01-01T00:00:00Z"), fin: new Date("2026-01-05T00:00:00Z"), plazoHoras: 48 }] as never;
    const r = await cambiarEstadoEnvio(deps)(1, 1, { estado: "entregado" });
    expect(r.ordenEstado).toBe("entregada");
    // entrega actual: 24 h <= 48 (a tiempo); la previa: 96 h > 48 (tarde) -> 50%
    expect(st.pct).toBe(50);
  });
  it("porcentajeATiempo ignora entregas sin plazo", () => {
    const d = (h: number, plazo: number | null) => ({ inicio: new Date(0), fin: new Date(h * 3_600_000), plazoHoras: plazo });
    expect(porcentajeATiempo([d(10, 48), d(10, null)])).toBe(100);
    expect(porcentajeATiempo([d(10, null)])).toBeNull();
    expect(porcentajeATiempo([d(10, 48), d(50, 48), d(60, 48)])).toBe(33.33);
  });
});
