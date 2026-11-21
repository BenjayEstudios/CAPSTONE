import "dotenv/config";
import {
  confirmarRetornoPago,
  emitirDocumentosOrden,
  iniciarPago,
  notificarOrdenPagada
} from "@cotizapp/application";
import type { PagoIniciado, PasarelaPago, SolicitudPago, TransaccionPago } from "@cotizapp/domain";
import {
  createDbClient,
  DrizzleDocumentoTributarioRepository,
  DrizzleOrdenRepository,
  DrizzleProveedorRepository,
  DrizzleUsuarioRepository,
  PasarelaEnMemoria
} from "@cotizapp/infrastructure";
import { loadEnv } from "../config/env.js";
import { crearServicioCorreo } from "../lib/mail.js";

// Datos de prueba de movimientos (compras, pagos, envios, reembolsos,
// liquidaciones, calificaciones, moderacion y eventos). Uso, con el backend
// levantado en API_URL (default http://localhost:8000) y la base local:
//   pnpm --filter=@cotizapp/backend job:datos-de-prueba
//
// - Solo corre contra una base local (localhost, 127.0.0.1 o el host "mysql" de
//   docker-compose) y nunca con NODE_ENV=production.
// - Usa la API real (registro, carro, orden, envios, reembolsos, liquidaciones,
//   moderacion, eventos) con las cuentas qa-*@cotizapp.test (clave Cotizapp.2026)
//   y el administrador de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
// - Los PAGOS no pasan por PayPal: se corren los mismos casos de uso del
//   retorno (iniciarPago + confirmarRetornoPago) con una pasarela en memoria
//   que se declara "paypal-prueba" en la auditoria.
// - Es de una sola vez: si ya existen las cuentas qa-*, no hace nada.
const API = process.env.API_URL ?? "http://localhost:8000";
const CLAVE = "Cotizapp.2026";
const env = loadEnv();
const host = new URL(env.DATABASE_URL).hostname;
if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]", "mysql"].includes(host)) {
  console.error(`Rechazado: la base "${host}" no es local o NODE_ENV=production.`);
  process.exit(1);
}
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminClave = process.env.SEED_ADMIN_PASSWORD;
if (!adminEmail || !adminClave) {
  console.error("Faltan SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (usuario administrador para operar la API).");
  process.exit(1);
}

// ---- HTTP ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resp = { s: number; o: any };
async function api(metodo: string, ruta: string, cuerpo?: unknown, token?: string): Promise<Resp> {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  let o: unknown = t;
  try {
    o = t ? JSON.parse(t) : null;
  } catch {
    /* texto */
  }
  return { s: r.status, o };
}
async function ok(r: Promise<Resp>, que: string): Promise<Resp> {
  const x = await r;
  if (x.s >= 300) throw new Error(`${que}: ${x.s} ${JSON.stringify(x.o).slice(0, 300)}`);
  return x;
}

// ---- RUT valido ----
function rut(base: number): string {
  let suma = 0;
  let mul = 2;
  for (const d of String(base).split("").reverse()) {
    suma += Number(d) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return `${base}-${r === 11 ? "0" : r === 10 ? "K" : r}`;
}

// ---- Pasarela de prueba: responde lo que se le indique, se declara "paypal-prueba" ----
class PasarelaDePrueba implements PasarelaPago {
  readonly nombre = "paypal-prueba";
  private readonly base = new PasarelaEnMemoria();
  responder(token: string, r: Partial<TransaccionPago>) {
    this.base.responder(token, r);
  }
  iniciar(s: SolicitudPago): Promise<PagoIniciado> {
    return this.base.iniciar(s);
  }
  confirmar(token: string) {
    return this.base.confirmar(token);
  }
}

const { db, pool } = createDbClient(env.DATABASE_URL);
const pasarela = new PasarelaDePrueba();
const ordenRepository = new DrizzleOrdenRepository(db);
const usuarioRepository = new DrizzleUsuarioRepository(db);
const servicioCorreo = crearServicioCorreo(env);

interface Comprador {
  email: string;
  token: string;
  usuarioId: number;
}

async function comprador(nombre: string, email: string, base: number, empresa?: { razonSocial: string; giro: string }): Promise<Comprador> {
  await ok(
    api("POST", "/auth/registro/comprador", {
      nombre,
      email,
      clave: CLAVE,
      rut: rut(base),
      telefono: "+56912345678",
      ...(empresa ? { empresa: { ...empresa, rut: rut(base + 1000000), telefono: "+56223456789" } } : {})
    }),
    `registro ${email}`
  );
  const l = await ok(api("POST", "/auth/login", { email, clave: CLAVE }), `login ${email}`);
  return { email, token: l.o.token, usuarioId: l.o.usuario.id };
}

try {
  const yaExiste = await api("POST", "/auth/login", { email: "qa-aromos@cotizapp.test", clave: CLAVE });
  if (yaExiste.s === 200) {
    console.log("Los datos de prueba ya estaban cargados (existe qa-aromos@cotizapp.test). No se hizo nada.");
    process.exit(0);
  }

  const admin = await ok(api("POST", "/auth/admin/login", { email: adminEmail, clave: adminClave }), "login admin");
  if (!admin.o.token) throw new Error("El administrador exige 2FA: desactivalo para cargar datos de prueba.");
  const tAdmin: string = admin.o.token;

  // Catalogo: ofertas disponibles con su producto.
  const lista = await ok(api("GET", "/catalogo/productos?tamano=50"), "catalogo");
  const ofertas: Array<{ id: number; precio: number; proveedorId: number; producto: string }> = [];
  for (const p of lista.o.items as Array<{ id: number; nombre: string }>) {
    const d = await ok(api("GET", `/catalogo/productos/${p.id}`), `producto ${p.id}`);
    for (const o of d.o.ofertas ?? []) ofertas.push({ id: o.id, precio: o.precioUnitario, proveedorId: o.proveedor.id, producto: p.nombre });
  }
  if (ofertas.length < 4) throw new Error("Hay pocas ofertas en el catalogo para armar compras variadas.");
  const comunas = (await ok(api("GET", "/comunas"), "comunas")).o as Array<{ id: number; nombre: string; regionCodigo: string }>;
  const rm = comunas.filter((c) => c.regionCodigo === "RM");
  const enProveedor = (pid: number) => ofertas.filter((o) => o.proveedorId === pid);
  const proveedores = [...new Set(ofertas.map((o) => o.proveedorId))];

  const aromos = await comprador("Camila Rojas", "qa-aromos@cotizapp.test", 12345678, { razonSocial: "Restaurante Los Aromos SpA", giro: "Restaurantes" });
  const sanJose = await comprador("Pedro Soto", "qa-sanjose@cotizapp.test", 13456789, { razonSocial: "Panaderia San Jose Ltda.", giro: "Panaderias" });
  const persona = await comprador("Ana Vega", "qa-vega@cotizapp.test", 14567890);

  // Crea una orden pendiente_pago con las ofertas dadas.
  async function orden(c: Comprador, items: Array<[number, number]>, comunaIdx: number, factura = false) {
    const lineas = items.map(([i, cantidad]) => ({ ofertaId: ofertas[i]!.id, cantidad, precioVisto: ofertas[i]!.precio }));
    await ok(api("PUT", "/carro", { items: lineas }, c.token), "carro");
    const co = rm[comunaIdx % rm.length]!;
    const r = await ok(
      api("POST", "/carro/confirmar", { direccion: { comunaId: co.id, calle: `Calle ${comunaIdx + 1}`, numero: String(100 + comunaIdx * 7) }, retiros: [], requiereFactura: factura }, c.token),
      "confirmar"
    );
    return r.o as { ordenId: number; codigo: string; total: number; envios: Array<{ proveedorId: number }> };
  }

  // Pago por los casos de uso reales con la pasarela de prueba.
  async function pagar(c: Comprador, ordenId: number, resultado: "aprobado" | "rechazado" | "anulado") {
    const ini = await iniciarPago({ ordenRepository, usuarioRepository, pasarela, urlRetorno: `${API}/pagos/paypal/retorno` })(c.usuarioId, ordenId, { medioPago: "tarjeta" });
    if (resultado === "rechazado") pasarela.responder(ini.token, { aprobado: false, codigoRespuesta: -1 });
    const retorno = confirmarRetornoPago({
      ordenRepository,
      pasarela,
      alAprobar: (id) => emitirDocumentosOrden({ documentoRepository: new DrizzleDocumentoTributarioRepository(db) })(id),
      alPagar: (id) =>
        notificarOrdenPagada({ ordenRepository, usuarioRepository, proveedorRepository: new DrizzleProveedorRepository(db), servicioCorreo, urlPanelProveedor: `${env.ECOMMERCE_URL.replace(/\/$/, "")}/proveedor/ventas` })(id)
    });
    return retorno(resultado === "anulado" ? { TBK_TOKEN: ini.token } : { token_ws: ini.token });
  }

  async function envios(ordenId: number): Promise<Array<{ id: number; proveedorId: number }>> {
    const o = await ok(api("GET", `/ordenes/${ordenId}`, undefined, tAdmin), "detalle orden");
    return o.o.envios;
  }
  async function avanzar(envioId: number, hasta: Array<"en_preparacion" | "despachado" | "entregado">) {
    for (const estado of hasta) await ok(api("PATCH", `/ordenes/envios/${envioId}/estado`, { estado }, tAdmin), `envio ${envioId} -> ${estado}`);
  }
  const ENTREGA: Array<"en_preparacion" | "despachado" | "entregado"> = ["en_preparacion", "despachado", "entregado"];

  const resumen: string[] = [];
  const anota = (cod: string, que: string) => resumen.push(`${cod}  ${que}`);

  // 1. Aromos, factura, dos proveedores, todo entregado y calificado.
  const p0 = proveedores[0]!;
  const p1 = proveedores[1] ?? p0;
  const idxA = ofertas.findIndex((o) => o.proveedorId === p0);
  const idxB = ofertas.findIndex((o) => o.proveedorId === p1);
  const o1 = await orden(aromos, [[idxA, 6], [idxB, 4]], 0, true);
  await pagar(aromos, o1.ordenId, "aprobado");
  const e1 = await envios(o1.ordenId);
  for (const e of e1) await avanzar(e.id, ENTREGA);
  await ok(api("POST", `/ordenes/envios/${e1[0]!.id}/calificacion`, { puntaje: 5, comentario: "Llego antes de lo prometido y todo en orden." }, aromos.token), "calificar 1");
  if (e1[1]) await ok(api("POST", `/ordenes/envios/${e1[1].id}/calificacion`, { puntaje: 4, comentario: "Buen producto, el despacho se demoro un poco." }, aromos.token), "calificar 2");
  anota(o1.codigo, `Los Aromos · factura · ${o1.envios.length} envios entregados y calificados · $${o1.total}`);

  // 2. Aromos: uno despachado y otro en preparacion.
  const o2 = await orden(aromos, [[idxA, 3], [idxB, 2]], 1);
  await pagar(aromos, o2.ordenId, "aprobado");
  const e2 = await envios(o2.ordenId);
  await avanzar(e2[0]!.id, ["en_preparacion", "despachado"]);
  if (e2[1]) await avanzar(e2[1].id, ["en_preparacion"]);
  anota(o2.codigo, "Los Aromos · despachada / en preparacion");

  // 3. San Jose: entregada, luego reembolso parcial (abre caso de moderacion).
  const o3 = await orden(sanJose, [[idxB, 5]], 2);
  await pagar(sanJose, o3.ordenId, "aprobado");
  for (const e of await envios(o3.ordenId)) await avanzar(e.id, ENTREGA);
  await ok(api("POST", `/ordenes/${o3.ordenId}/reembolsos`, { monto: 2000, motivo: "Dos cajas llegaron con el envase danado" }, tAdmin), "reembolso parcial");
  anota(o3.codigo, "San Jose · entregada · reembolso parcial $2.000");

  // 4. San Jose: reembolso total de una orden pagada.
  const o4 = await orden(sanJose, [[idxA, 2]], 3);
  await pagar(sanJose, o4.ordenId, "aprobado");
  await ok(api("POST", `/ordenes/${o4.ordenId}/reembolsos`, { motivo: "El cliente anulo la compra antes del despacho" }, tAdmin), "reembolso total");
  anota(o4.codigo, "San Jose · reembolso total");

  // 5. Recien pagada, por despachar.
  const o5 = await orden(sanJose, [[idxA, 1], [idxB, 1]], 4);
  await pagar(sanJose, o5.ordenId, "aprobado");
  anota(o5.codigo, "San Jose · pagada, por despachar");

  // 6-8. Vega: pago rechazado, pago anulado y orden sin pagar.
  const o6 = await orden(persona, [[idxB, 2]], 5);
  await pagar(persona, o6.ordenId, "rechazado");
  anota(o6.codigo, "Vega · pago rechazado (orden pendiente)");
  const o7 = await orden(persona, [[idxA, 2]], 6);
  await pagar(persona, o7.ordenId, "anulado");
  anota(o7.codigo, "Vega · pago anulado por el comprador");
  const o8 = await orden(persona, [[idxA, 1]], 7);
  anota(o8.codigo, "Vega · sin iniciar el pago");

  // Liquidaciones del dia: se generan y se paga la primera.
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const gen = await ok(api("POST", "/liquidaciones/generar", { desde: hoy, hasta: hoy }, tAdmin), "generar liquidaciones");
  const liqs: Array<{ id: number }> = gen.o.liquidaciones ?? [];
  if (liqs[0]) await ok(api("POST", `/liquidaciones/${liqs[0].id}/pagar`, { fechaPago: hoy }, tAdmin), "pagar liquidacion");

  // Moderacion: dos proveedores nuevos (alta_proveedor) y resolver/descartar algunos casos.
  await ok(
    api("POST", "/auth/registro/proveedor", { nombre: "Marcela Pino", email: "qa-prov-sur@cotizapp.test", clave: CLAVE, empresa: { razonSocial: "Carnes del Sur SpA", rut: rut(76543210), giro: "Distribucion de carnes" } }),
    "registro proveedor 1"
  );
  await ok(
    api("POST", "/auth/registro/proveedor", { nombre: "Luis Araya", email: "qa-prov-verde@cotizapp.test", clave: CLAVE, empresa: { razonSocial: "Verde Fresco Ltda.", rut: rut(76432109), giro: "Frutas y verduras" } }),
    "registro proveedor 2"
  );
  const casos = (await ok(api("GET", "/moderacion/casos?tamano=50", undefined, tAdmin), "casos")).o.items as Array<{ id: number; tipo: string; estado: string }>;
  const abiertosReembolso = casos.filter((c) => c.tipo === "reembolso" && c.estado === "abierto");
  const abiertosAlta = casos.filter((c) => c.tipo === "alta_proveedor" && c.estado === "abierto");
  if (abiertosReembolso[0]) await ok(api("POST", `/moderacion/casos/${abiertosReembolso[0].id}/resolver`, { nota: "Reembolso revisado: corresponde por envase danado." }, tAdmin), "resolver caso");
  if (abiertosAlta[1]) await ok(api("POST", `/moderacion/casos/${abiertosAlta[1].id}/descartar`, { motivo: "Datos de la empresa incompletos; se pidio reenviar." }, tAdmin), "descartar caso");

  // Eventos analiticos: vistas, clicks y busquedas de varias sesiones.
  const terminos = ["arroz", "aceite vegetal", "leche uht", "queso", "papa", "lentejas", "agua mineral"];
  const eventos: unknown[] = [];
  for (let s = 0; s < 8; s++) {
    const sesion = `sesion-qa-${String(s).padStart(4, "0")}`;
    eventos.push({ tipo_evento: "busqueda", sesion_id: sesion, termino: terminos[s % terminos.length], resultados: (s * 3) % 9 });
    const pr = lista.o.items[s % lista.o.items.length];
    eventos.push({ tipo_evento: "vista_producto", sesion_id: sesion, producto_id: pr.id, origen: s % 2 ? "busqueda" : "catalogo" });
    const of = ofertas[s % ofertas.length]!;
    eventos.push({ tipo_evento: "click_oferta", sesion_id: sesion, producto_id: pr.id, oferta_id: of.id, convirtio: s % 3 === 0 });
  }
  for (let i = 0; i < eventos.length; i += 20) await ok(api("POST", "/eventos/lote", { eventos: eventos.slice(i, i + 20) }), "eventos");

  console.log("Datos de prueba cargados:\n" + resumen.map((l) => "  " + l).join("\n"));
  console.log(`  + ${liqs.length} liquidaciones del dia (1 pagada), 2 proveedores nuevos en moderacion, ${eventos.length} eventos analiticos`);
  console.log(`Cuentas: qa-aromos / qa-sanjose / qa-vega @cotizapp.test (clave ${CLAVE}).`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
