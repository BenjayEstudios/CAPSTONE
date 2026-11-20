import { describe, expect, it } from "vitest";
import type {
  Orden,
  OrdenRepository,
  PasarelaPago,
  RegistroAuditoria,
  ResultadoPagoOrden,
  SolicitudPago,
  TransaccionPago,
  UsuarioRepository
} from "@cotizapp/domain";
import { confirmarRetornoPago, iniciarPago, ordenCompraDe, sesionDeOrden } from "./pagos.use-cases.js";

const falla = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as { statusCode: number; code: string });

const ordenBase = (extra: Partial<Orden> = {}): Orden => ({
  id: 12, codigo: "CM-90012", usuarioId: 8, organizacionId: 6, direccionEntregaId: 6, subtotal: 67170, costoDespachoTotal: 12980,
  comisionTotal: 5000, total: 80150, requiereFactura: false, estado: "pendiente_pago", medioPago: null, estadoPago: "autorizado",
  referenciaPasarela: null, creadaEn: new Date("2026-11-20T22:00:00Z"), pagadoEn: null, ...extra
});

function setup(ordenExtra: Partial<Orden> = {}, tipoOrg = "cliente") {
  const st = {
    orden: ordenBase(ordenExtra),
    resultados: [] as Array<{ ordenId: number; r: ResultadoPagoOrden; a: RegistroAuditoria }>,
    solicitudes: [] as SolicitudPago[],
    confirmados: [] as string[],
    respuesta: null as Partial<TransaccionPago> | Error | null,
    aprobadas: [] as number[]
  };
  const ordenRepository = {
    async buscarPorId(id: number, alcance: { tipo: string; usuarioId?: number }) {
      if (id !== st.orden.id || (alcance.tipo === "cliente" && alcance.usuarioId !== st.orden.usuarioId)) return null;
      return { orden: st.orden, envios: [], clienteNombre: "", organizacionNombre: "", direccionEntrega: null };
    },
    async buscarPorReferenciaPasarela(ref: string) {
      return st.orden.referenciaPasarela === ref ? st.orden : null;
    },
    async registrarInicioPago(_id: number, ref: string) {
      st.orden = { ...st.orden, referenciaPasarela: ref };
    },
    async registrarResultadoPago(ordenId: number, r: ResultadoPagoOrden, a: RegistroAuditoria) {
      if (st.orden.estado !== "pendiente_pago") return false;
      st.resultados.push({ ordenId, r, a });
      st.orden = r.aprobado
        ? { ...st.orden, estado: "pagada", estadoPago: "pagado", medioPago: r.medioPago }
        : { ...st.orden, estadoPago: "fallido", medioPago: r.medioPago };
      return true;
    }
  } as unknown as OrdenRepository;
  const usuarioRepository = {
    async buscarPorId(id: number) {
      return { usuario: { id, estado: "activo", organizacionId: 6 }, rol: { codigo: "comprador", permisos: {} }, organizacion: { id: 6, tipo: tipoOrg, estado: "activa" } };
    }
  } as unknown as UsuarioRepository;
  let n = 0;
  const pasarela: PasarelaPago = {
    nombre: "prueba",
    async iniciar(s) {
      st.solicitudes.push(s);
      return { token: `tok-${++n}`, url: "https://pasarela.test/pagar" };
    },
    async confirmar(token) {
      st.confirmados.push(token);
      if (st.respuesta instanceof Error) throw st.respuesta;
      return {
        aprobado: true, ordenCompra: st.orden.codigo, sesionId: sesionDeOrden(st.orden.id), monto: st.orden.total,
        codigoAutorizacion: "1213", codigoRespuesta: 0, tipoTarjeta: "credito", ultimosDigitos: "6623", cuotas: 0, ...st.respuesta
      };
    }
  };
  const inicio = iniciarPago({ ordenRepository, usuarioRepository, pasarela, urlRetorno: "http://api.test/pagos/webpay/retorno" });
  const retorno = confirmarRetornoPago({ ordenRepository, pasarela, alAprobar: async (id) => void st.aprobadas.push(id) });
  return { st, inicio, retorno };
}

describe("iniciarPago (KAN-95)", () => {
  it("crea la transaccion por el total de la orden y guarda el token", async () => {
    const { st, inicio } = setup();
    const r = await inicio(8, 12, { medioPago: "tarjeta" });
    expect(r).toEqual({ ordenId: 12, codigo: "CM-90012", total: 80150, pasarela: "prueba", urlPago: "https://pasarela.test/pagar", token: "tok-1" });
    expect(st.solicitudes[0]).toEqual({ ordenCompra: "CM-90012", sesionId: "orden-12", monto: 80150, urlRetorno: "http://api.test/pagos/webpay/retorno" });
    expect(st.orden.referenciaPasarela).toBe("tok-1");
  });

  it("un reintento usa otra orden de compra (Webpay no acepta repetirla) y reemplaza el token", async () => {
    const { st, inicio } = setup({ referenciaPasarela: "tok-viejo" });
    await inicio(8, 12, {});
    expect(st.solicitudes[0]!.ordenCompra).toMatch(/^CM-90012-[0-9a-z]+$/);
    expect(st.solicitudes[0]!.ordenCompra.length).toBeLessThanOrEqual(26);
    expect(st.orden.referenciaPasarela).toBe("tok-1");
  });

  it("rechaza: orden ajena (404), ya pagada (409), medio no disponible (409) y un proveedor (403)", async () => {
    expect((await falla(setup().inicio(99, 12, {})))?.code).toBe("ORDEN_NO_ENCONTRADA");
    expect((await falla(setup({ estado: "pagada", estadoPago: "pagado" }).inicio(8, 12, {})))?.code).toBe("ORDEN_YA_PAGADA");
    expect((await falla(setup().inicio(8, 12, { medioPago: "transferencia" })))?.code).toBe("MEDIO_PAGO_NO_DISPONIBLE");
    expect((await falla(setup({}, "proveedor").inicio(8, 12, {})))?.statusCode).toBe(403);
  });

  it("ordenCompraDe respeta el maximo de 26 caracteres", () => {
    expect(ordenCompraDe({ codigo: "CM-90012", referenciaPasarela: null })).toBe("CM-90012");
    expect(ordenCompraDe({ codigo: "CM-90012", referenciaPasarela: "x" }, 1_800_000_000_000)).toBe("CM-90012-mywpiww0");
  });
});

describe("confirmarRetornoPago (KAN-95)", () => {
  it("token_ws aprobado: confirma, deja la orden pagada con tarjeta, audita y emite documentos", async () => {
    const { st, retorno } = setup({ referenciaPasarela: "tok-1" });
    expect(await retorno({ token_ws: "tok-1" })).toEqual({ ordenId: 12, resultado: "aprobado" });
    expect(st.confirmados).toEqual(["tok-1"]);
    expect(st.orden).toMatchObject({ estado: "pagada", estadoPago: "pagado", medioPago: "tarjeta" });
    expect(st.resultados[0]!.a).toMatchObject({ entidad: "orden", entidadId: 12, accion: "editar", datosDespues: { operacion: "pago_aprobado", codigoAutorizacion: "1213", ultimosDigitos: "6623" } });
    expect(st.aprobadas).toEqual([12]);
  });

  it("rechazo de la tarjeta o monto distinto al total: queda fallido y sin documentos", async () => {
    const rechazo = setup({ referenciaPasarela: "tok-1" });
    rechazo.st.respuesta = { aprobado: false, codigoRespuesta: -1 };
    expect(await rechazo.retorno({ token_ws: "tok-1" })).toEqual({ ordenId: 12, resultado: "rechazado" });
    expect(rechazo.st.orden.estadoPago).toBe("fallido");
    expect(rechazo.st.aprobadas).toEqual([]);

    const otroMonto = setup({ referenciaPasarela: "tok-1" });
    otroMonto.st.respuesta = { monto: 1000 };
    expect((await otroMonto.retorno({ token_ws: "tok-1" })).resultado).toBe("rechazado");
    expect(otroMonto.st.orden.estado).toBe("pendiente_pago");
  });

  it("un retorno repetido no vuelve a confirmar en la pasarela", async () => {
    const { st, retorno } = setup({ referenciaPasarela: "tok-1", estado: "pagada", estadoPago: "pagado" });
    expect(await retorno({ token_ws: "tok-1" })).toEqual({ ordenId: 12, resultado: "aprobado" });
    expect(st.confirmados).toEqual([]);
  });

  it("TBK_TOKEN (anulado): marca fallido solo si el token es el de la orden; tiempo agotado no toca la orden", async () => {
    const anulado = setup({ referenciaPasarela: "tok-1" });
    expect(await anulado.retorno({ TBK_TOKEN: "tok-1", TBK_ID_SESION: "orden-12", TBK_ORDEN_COMPRA: "CM-90012" })).toEqual({ ordenId: 12, resultado: "anulado" });
    expect(anulado.st.orden.estadoPago).toBe("fallido");
    expect(anulado.st.confirmados).toEqual([]);

    const ajeno = setup({ referenciaPasarela: "tok-1" });
    expect(await ajeno.retorno({ TBK_TOKEN: "otro", TBK_ID_SESION: "orden-12" })).toEqual({ ordenId: 12, resultado: "anulado" });
    expect(ajeno.st.resultados).toEqual([]);

    const tiempo = setup({ referenciaPasarela: "tok-1" });
    expect(await tiempo.retorno({ TBK_ID_SESION: "orden-12", TBK_ORDEN_COMPRA: "CM-90012" })).toEqual({ ordenId: 12, resultado: "anulado" });
    expect(tiempo.st.resultados).toEqual([]);
  });

  it("token desconocido o pasarela caida: error sin cambiar la orden", async () => {
    expect(await setup().retorno({ token_ws: "nadie" })).toEqual({ ordenId: null, resultado: "error" });
    const caida = setup({ referenciaPasarela: "tok-1" });
    caida.st.respuesta = new Error("timeout");
    expect(await caida.retorno({ token_ws: "tok-1" })).toEqual({ ordenId: 12, resultado: "error" });
    expect(caida.st.orden.estado).toBe("pendiente_pago");
    expect(await setup().retorno({ token_ws: 123 })).toEqual({ ordenId: null, resultado: "error" });
  });
});
