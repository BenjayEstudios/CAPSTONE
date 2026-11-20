import { expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { DrizzleAnaliticaRepository } from "../src/repositories/analitica.repository.js";
import { DrizzleCarroRepository } from "../src/repositories/carro.repository.js";
import { DrizzleComunaRepository } from "../src/repositories/comuna.repository.js";
import { DrizzleOfertaRepository } from "../src/repositories/oferta.repository.js";
import { DrizzleOrdenRepository } from "../src/repositories/orden.repository.js";
import { DrizzleProveedorRepository } from "../src/repositories/proveedor.repository.js";
import { consultar } from "../src/db/client.js";
import { orden } from "../src/db/schema/orden.schema.js";
import { tipoTarjetaWebpay, WebpayPlus } from "../src/pagos/webpay-plus.js";
import { describeDb } from "./db.js";

// Checkout y pago (KAN-95) contra el seed. Cada test corre en una
// transaccion que db.ts revierte.
const ORG = { losAndes: 2, valleCentral: 3, frigoSur: 4, elFogon: 6 };

describeDb("Checkout: opciones de entrega, comunas y pago de la orden", (db) => {
  it("opcionesEntrega: la direccion de El Fogon y solo los puntos de retiro activos de los proveedores pedidos", async () => {
    const o = await new DrizzleCarroRepository(db()).opcionesEntrega(ORG.elFogon, [ORG.losAndes, ORG.valleCentral]);
    expect(o.direcciones).toEqual([
      expect.objectContaining({ calle: "Av. Irarrázaval", numero: "3450", complemento: "Local 2", comuna: "Ñuñoa", region: "Metropolitana de Santiago" })
    ]);
    expect(o.puntosRetiro).toEqual([
      { id: 1, proveedorId: ORG.losAndes, nombre: "Bodega Quilicura", horario: expect.any(String), direccion: "Av. Presidente Eduardo Frei Montalva 9650, Bodega 12, Quilicura" }
    ]);
    expect((await new DrizzleCarroRepository(db()).opcionesEntrega(ORG.elFogon, [])).puntosRetiro).toEqual([]);
  });

  it("comunas: todas, con su region, ordenadas por region y nombre", async () => {
    const comunas = await new DrizzleComunaRepository(db()).listar();
    const [{ total }] = await consultar<{ total: number }>(db(), sql`SELECT COUNT(*) AS total FROM comuna`);
    expect(comunas).toHaveLength(Number(total));
    expect(comunas.find((c) => c.nombre === "Ñuñoa")).toEqual({ id: expect.any(Number), nombre: "Ñuñoa", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" });
  });

  it("detalle de la orden (KAN-96): el envio con retiro trae su punto; el despacho, null; el listado no lo trae", async () => {
    const repo = new DrizzleOrdenRepository(db());
    const [{ id }] = await consultar<{ id: number }>(
      db(),
      sql`SELECT MIN(orden_id) AS id FROM orden_envio WHERE modalidad = 'retiro' AND punto_retiro_id = 2`
    );
    const oc = await repo.buscarPorId(id, { tipo: "todas" });
    const retiro = oc!.envios.find((e) => e.modalidad === "retiro")!;
    expect(retiro.puntoRetiro).toEqual({ id: 2, nombre: "Planta Renca", horario: "Lun a Vie 07:30-16:00", direccion: "Av. Jorge Hirmas 2440, Renca" });
    for (const e of oc!.envios.filter((x) => x.modalidad === "despacho")) expect(e.puntoRetiro).toBeNull();
    const { items } = await repo.listar({ alcance: { tipo: "todas" }, pagina: 1, tamano: 100 });
    expect(items.find((o) => o.orden.id === id)!.envios.every((e) => e.puntoRetiro === undefined)).toBe(true);
  });

  it("detalle de la orden (KAN-99): cada envio trae la calificacion del comprador, o null", async () => {
    const repo = new DrizzleOrdenRepository(db());
    const [{ envio }] = await consultar<{ envio: number }>(db(), sql`SELECT MIN(orden_envio_id) AS envio FROM calificacion`);
    const [{ ordenId, puntaje }] = await consultar<{ ordenId: number; puntaje: number }>(
      db(),
      sql`SELECT e.orden_id AS ordenId, c.puntaje FROM orden_envio e JOIN calificacion c ON c.orden_envio_id = e.id WHERE e.id = ${envio}`
    );
    const oc = await repo.buscarPorId(ordenId, { tipo: "todas" });
    expect(oc!.envios.find((e) => e.id === envio)!.calificacion).toMatchObject({ puntaje, creadaEn: expect.any(Date) });
    const [{ sinCalificar }] = await consultar<{ sinCalificar: number }>(
      db(),
      sql`SELECT MIN(e.orden_id) AS sinCalificar FROM orden_envio e LEFT JOIN calificacion c ON c.orden_envio_id = e.id WHERE c.id IS NULL`
    );
    const otra = await repo.buscarPorId(sinCalificar, { tipo: "todas" });
    expect(otra!.envios.some((e) => e.calificacion === null)).toBe(true);
  });

  it("pendientesProveedor (KAN-101): coincide con contar directo en SQL", async () => {
    const p = await new DrizzleAnaliticaRepository(db()).pendientesProveedor(ORG.losAndes, 20);
    const [esperado] = await consultar<{ publicadas: number; borradores: number; bajo: number; sinLiquidar: string; porDespachar: number; pendientes: string }>(
      db(),
      sql`SELECT
            (SELECT COUNT(*) FROM oferta WHERE proveedor_id = ${ORG.losAndes} AND estado = 'publicada') AS publicadas,
            (SELECT COUNT(*) FROM oferta WHERE proveedor_id = ${ORG.losAndes} AND estado = 'borrador') AS borradores,
            (SELECT COUNT(*) FROM oferta WHERE proveedor_id = ${ORG.losAndes} AND estado = 'publicada' AND cajas_disponibles <= 20) AS bajo,
            (SELECT COALESCE(SUM(subtotal + COALESCE(costo_despacho, 0) - comision_monto), 0) FROM orden_envio
              WHERE proveedor_id = ${ORG.losAndes} AND estado = 'entregado' AND liquidacion_id IS NULL) AS sinLiquidar,
            (SELECT COUNT(*) FROM orden_envio oe JOIN orden o ON o.id = oe.orden_id
              WHERE oe.proveedor_id = ${ORG.losAndes} AND oe.estado = 'por_despachar' AND o.estado_pago = 'pagado') AS porDespachar,
            (SELECT COALESCE(SUM(monto_neto), 0) FROM liquidacion WHERE proveedor_id = ${ORG.losAndes} AND estado = 'pendiente') AS pendientes`
    );
    expect(p.ofertasPublicadas).toBe(Number(esperado!.publicadas));
    expect(p.ofertasBorrador).toBe(Number(esperado!.borradores));
    expect(p.stockBajo).toHaveLength(Number(esperado!.bajo));
    expect(p.stockBajo.every((s) => s.cajasDisponibles <= 20)).toBe(true);
    expect(p.entregadoSinLiquidar).toBe(Number(esperado!.sinLiquidar));
    expect(p.enviosPorDespachar).toBe(Number(esperado!.porDespachar));
    expect(p.liquidacionesPendientes).toBe(Number(esperado!.pendientes));
    expect(p.liquidacionesPendientes).toBeGreaterThan(0);
  });

  it("cobertura del proveedor (KAN-102): corte, despacho gratis y una zona por fila de proveedor_cobertura", async () => {
    const c = await new DrizzleProveedorRepository(db()).cobertura(ORG.losAndes);
    const [esperado] = await consultar<{ zonas: number; corte: string | null }>(
      db(),
      sql`SELECT (SELECT COUNT(*) FROM proveedor_cobertura WHERE proveedor_id = ${ORG.losAndes}) AS zonas,
                 (SELECT TIME_FORMAT(hora_corte, '%H:%i') FROM organizacion WHERE id = ${ORG.losAndes}) AS corte`
    );
    expect(c.zonas).toHaveLength(Number(esperado!.zonas));
    expect(c.horaCorte).toBe(esperado!.corte);
    expect(c.zonas.find((z) => z.regionCodigo === "13")).toMatchObject({ comunaId: null, region: "Metropolitana de Santiago", costoDespacho: 4990 });
    expect(c.ofreceDespacho).toBe(true);
  });

  it("productos disponibles traen el contenido del formato (KAN-102)", async () => {
    const { items } = await new DrizzleOfertaRepository(db()).productosDisponibles(ORG.losAndes, { pagina: 1, tamano: 50 });
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) expect(p.contenido === null || typeof p.contenido === "number").toBe(true);
    expect(items.some((p) => typeof p.contenido === "number" && p.contenido > 0)).toBe(true);
  });

  it("registrarResultadoPago: aprueba una orden pendiente una sola vez y la encuentra por su token", async () => {
    const repo = new DrizzleOrdenRepository(db());
    const [{ id }] = await consultar<{ id: number }>(db(), sql`SELECT MIN(id) AS id FROM orden`);
    await db().update(orden).set({ estado: "pendiente_pago", estadoPago: "autorizado", medioPago: null, pagadoEn: null }).where(eq(orden.id, id));
    await repo.registrarInicioPago(id, "tok-prueba");
    expect((await repo.buscarPorReferenciaPasarela("tok-prueba"))?.id).toBe(id);
    expect(await repo.buscarPorReferenciaPasarela("no-existe")).toBeNull();

    const auditoria = { usuarioId: null, entidad: "orden", entidadId: id, accion: "editar" as const, datosAntes: null, datosDespues: { operacion: "pago_aprobado" } };
    expect(await repo.registrarResultadoPago(id, { aprobado: true, medioPago: "tarjeta", referencia: "tok-prueba" }, auditoria)).toBe(true);
    const o = await repo.buscarPorReferenciaPasarela("tok-prueba");
    expect(o).toMatchObject({ estado: "pagada", estadoPago: "pagado", medioPago: "tarjeta" });
    expect(o?.pagadoEn).toBeInstanceOf(Date);
    // Un retorno repetido no la vuelve a tocar.
    expect(await repo.registrarResultadoPago(id, { aprobado: false, medioPago: "tarjeta", referencia: "tok-prueba" }, auditoria)).toBe(false);
    expect((await repo.buscarPorReferenciaPasarela("tok-prueba"))?.estadoPago).toBe("pagado");
  });
});

it("WebpayPlus: crea la transaccion y confirma con las cabeceras de Transbank", async () => {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const respuestas = [
    { token: "01ab", url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction" },
    { status: "AUTHORIZED", response_code: 0, amount: 80150, buy_order: "CM-90012", session_id: "orden-12", authorization_code: "1213", payment_type_code: "VD", installments_number: 0, card_detail: { card_number: "6623" } }
  ];
  const fetchFalso = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(respuestas.shift()), { status: 200 });
  }) as unknown as typeof fetch;
  const w = new WebpayPlus({ codigoComercio: "597055555532", apiKey: "secreto", baseUrl: "https://webpay3gint.transbank.cl", fetch: fetchFalso });

  expect(await w.iniciar({ ordenCompra: "CM-90012", sesionId: "orden-12", monto: 80150, urlRetorno: "http://api/pagos/webpay/retorno" })).toEqual({
    token: "01ab", url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction"
  });
  expect(llamadas[0]!.url).toBe("https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions");
  expect(llamadas[0]!.init.method).toBe("POST");
  expect(llamadas[0]!.init.headers).toMatchObject({ "Tbk-Api-Key-Id": "597055555532", "Tbk-Api-Key-Secret": "secreto" });
  expect(JSON.parse(String(llamadas[0]!.init.body))).toEqual({ buy_order: "CM-90012", session_id: "orden-12", amount: 80150, return_url: "http://api/pagos/webpay/retorno" });

  expect(await w.confirmar("01ab")).toEqual({
    aprobado: true, ordenCompra: "CM-90012", sesionId: "orden-12", monto: 80150, codigoAutorizacion: "1213", codigoRespuesta: 0,
    tipoTarjeta: "debito", ultimosDigitos: "6623", cuotas: 0
  });
  expect(llamadas[1]!.init.method).toBe("PUT");
  expect(llamadas[1]!.url).toMatch(/\/transactions\/01ab$/);
});

it("WebpayPlus: rechazo (response_code distinto de 0) no lanza; un error HTTP si", async () => {
  const una = (cuerpo: unknown, status = 200) => (async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch;
  const base = { codigoComercio: "x", apiKey: "y", baseUrl: "https://w" };
  const rechazo = await new WebpayPlus({ ...base, fetch: una({ status: "FAILED", response_code: -1, amount: 1000 }) }).confirmar("t");
  expect(rechazo).toMatchObject({ aprobado: false, codigoRespuesta: -1 });
  await expect(new WebpayPlus({ ...base, fetch: una({ error_message: "Invalid value for parameter: token" }, 422) }).confirmar("t")).rejects.toThrow(
    "Webpay 422: Invalid value for parameter: token"
  );
  expect([tipoTarjetaWebpay("VD"), tipoTarjetaWebpay("VP"), tipoTarjetaWebpay("VN"), tipoTarjetaWebpay(undefined)]).toEqual(["debito", "prepago", "credito", null]);
});
