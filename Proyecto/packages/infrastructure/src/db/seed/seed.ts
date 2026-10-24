import bcrypt from "bcryptjs";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../schema/index.js";
import { categorias, comunaId, comunas, productos, ROL, roles } from "./catalogo.js";

type Db = MySql2Database<typeof schema>;

// Columnas `date` (sin hora) del schema: Drizzle las tipa como string "AAAA-MM-DD".
function soloFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Clave comun de TODOS los usuarios de prueba (solo para desarrollo local).
// Documentada tambien en packages/infrastructure/README.md.
export const CLAVE_PRUEBA = "Cotizapp.2026";

// Digito verificador de RUT (modulo 11), para que los RUT de prueba pasen
// cualquier validacion que se agregue despues.
function rut(cuerpo: number): string {
  let suma = 0;
  let factor = 2;
  for (const d of String(cuerpo).split("").reverse()) {
    suma += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (suma % 11);
  return `${cuerpo}-${dv === 11 ? "0" : dv === 10 ? "K" : dv}`;
}

const ORG = { cotizapp: 1, losAndes: 2, valleCentral: 3, frigoSur: 4, lasPalmas: 5, elFogon: 6, dulceHogar: 7 } as const;
const USR = { admin: 1, editor: 2, soporte: 3, losAndes: 4, valleCentral: 5, frigoSur: 6, lasPalmas: 7, elFogon: 8, dulceHogar: 9 };

const RUT = {
  [ORG.cotizapp]: rut(77123456),
  [ORG.losAndes]: rut(76543210),
  [ORG.valleCentral]: rut(76987654),
  [ORG.frigoSur]: rut(96555444),
  [ORG.lasPalmas]: rut(77888999),
  [ORG.elFogon]: rut(76111222),
  [ORG.dulceHogar]: rut(77333444)
};

// Parametros comerciales por proveedor, reutilizados en ofertas y ordenes.
// costoDespachoRM es la tarifa de proveedor_cobertura para la RM, que es
// donde estan todos los clientes del seed.
const PROVEEDOR = {
  [ORG.losAndes]: { comisionPct: 8, plazoHoras: 24, gratisDesde: 150000, costoDespachoRM: 4990, modalidad: "ambos" },
  [ORG.valleCentral]: { comisionPct: 7.5, plazoHoras: 48, gratisDesde: 200000, costoDespachoRM: 5990, modalidad: "despacho" },
  [ORG.frigoSur]: { comisionPct: 9, plazoHoras: 24, gratisDesde: 120000, costoDespachoRM: 6990, modalidad: "ambos" },
  [ORG.lasPalmas]: { comisionPct: 8, plazoHoras: 48, gratisDesde: 80000, costoDespachoRM: 2990, modalidad: "despacho" }
} as const;

type ProveedorId = keyof typeof PROVEEDOR;

// [productoId, proveedorId, precioUnitario, unidadesPorCaja, estado?]
// Cada producto tiene 1-3 proveedores con precios distintos para que el
// comparador tenga algo que comparar. La palta de Las Palmas esta a
// proposito sobre el tope de referencia (genera caso de moderacion).
const OFERTAS: [number, ProveedorId, number, number, ("borrador" | "publicada" | "pausada")?][] = [
  [1, ORG.losAndes, 12490, 4],
  [1, ORG.valleCentral, 12890, 4],
  [2, ORG.losAndes, 9490, 12],
  [2, ORG.valleCentral, 10290, 12],
  [3, ORG.losAndes, 7190, 4],
  [3, ORG.valleCentral, 6990, 4],
  [4, ORG.losAndes, 2590, 10],
  [4, ORG.valleCentral, 2490, 10],
  [5, ORG.valleCentral, 20990, 1],
  [5, ORG.losAndes, 22490, 1],
  [6, ORG.valleCentral, 26990, 1],
  [6, ORG.losAndes, 27490, 1],
  [7, ORG.frigoSur, 10490, 6],
  [7, ORG.losAndes, 11290, 6],
  [8, ORG.frigoSur, 8590, 6],
  [8, ORG.valleCentral, 9190, 6],
  [9, ORG.losAndes, 1090, 12],
  [9, ORG.valleCentral, 1150, 12],
  [9, ORG.frigoSur, 1120, 12],
  [10, ORG.valleCentral, 5190, 12],
  [10, ORG.frigoSur, 5390, 12],
  [11, ORG.losAndes, 6590, 6],
  [11, ORG.valleCentral, 6890, 6],
  [12, ORG.frigoSur, 11490, 10],
  [12, ORG.losAndes, 12490, 10],
  [13, ORG.frigoSur, 5990, 10],
  [13, ORG.losAndes, 6290, 10],
  [14, ORG.valleCentral, 4790, 10],
  [14, ORG.lasPalmas, 7490, 10, "borrador"],
  [15, ORG.valleCentral, 1390, 18],
  [15, ORG.lasPalmas, 1290, 18, "borrador"],
  [16, ORG.losAndes, 3090, 6],
  [16, ORG.valleCentral, 3190, 6, "pausada"],
  [17, ORG.losAndes, 7590, 10]
];

const ofertas = OFERTAS.map(([productoId, proveedorId, precioUnitario, unidadesPorCaja, estado], i) => {
  const id = i + 1;
  const cajasIniciales = 30 + ((id * 17) % 70);
  return {
    id,
    productoId,
    proveedorId,
    precioUnitario,
    unidadesPorCaja,
    cajasIniciales,
    cajasDisponibles: cajasIniciales - ((id * 7) % 20),
    minimoCompra: 1,
    plazoHoras: PROVEEDOR[proveedorId].plazoHoras,
    modalidadEntrega: PROVEEDOR[proveedorId].modalidad,
    estado: estado ?? "publicada"
  };
});

function ofertaDe(productoId: number, proveedorId: ProveedorId) {
  const found = ofertas.find((o) => o.productoId === productoId && o.proveedorId === proveedorId);
  if (!found) throw new Error(`No hay oferta del proveedor ${proveedorId} para el producto ${productoId}`);
  return found;
}

export async function seed(db: Db) {
  await db.insert(schema.comuna).values(comunas);

  await db.insert(schema.direccion).values([
    { id: 1, comunaId: comunaId("13123"), calle: "Av. Providencia", numero: "1208", complemento: "Of. 501" },
    { id: 2, comunaId: comunaId("13125"), calle: "Av. Presidente Eduardo Frei Montalva", numero: "9650", complemento: "Bodega 12" },
    { id: 3, comunaId: comunaId("13124"), calle: "Camino Lo Boza", numero: "120" },
    { id: 4, comunaId: comunaId("13128"), calle: "Av. Jorge Hirmas", numero: "2440" },
    { id: 5, comunaId: comunaId("13119"), calle: "Camino a Rinconada", numero: "3100" },
    { id: 6, comunaId: comunaId("13120"), calle: "Av. Irarrázaval", numero: "3450", complemento: "Local 2", referencia: "Entrada de proveedores por calle lateral" },
    { id: 7, comunaId: comunaId("13114"), calle: "Av. Apoquindo", numero: "5550" }
  ]);

  const datosProveedor = (id: ProveedorId, horaCorte: string, ofreceRetiro: boolean, entregasATiempoPct: string, banco: string) => ({
    comisionPct: PROVEEDOR[id].comisionPct.toFixed(2),
    plazoEstandarHoras: PROVEEDOR[id].plazoHoras,
    plazoFueraRegionHoras: PROVEEDOR[id].plazoHoras * 3,
    horaCorte,
    despachoGratisDesde: PROVEEDOR[id].gratisDesde,
    ofreceDespacho: 1,
    ofreceRetiro: ofreceRetiro ? 1 : 0,
    entregasATiempoPct,
    banco,
    cuentaBancaria: `00-${String(id).padStart(3, "0")}-48213-0${id}`
  });

  await db.insert(schema.organizacion).values([
    { id: ORG.cotizapp, tipo: "interna", razonSocial: "Cotizapp SpA", rut: RUT[ORG.cotizapp], nombreFantasia: "Cotizapp", giro: "Plataforma de comercio electrónico", emailContacto: "contacto@cotizapp.test", telefono: "+56 2 2900 1000", direccionId: 1, estado: "activa" },
    { id: ORG.losAndes, tipo: "proveedor", razonSocial: "Distribuidora Los Andes Ltda.", rut: RUT[ORG.losAndes], nombreFantasia: "Los Andes Food Service", giro: "Distribución mayorista de alimentos", emailContacto: "ventas@losandes.test", telefono: "+56 2 2600 4100", direccionId: 2, estado: "activa", ...datosProveedor(ORG.losAndes, "14:00:00", true, "96.50", "Banco de Chile") },
    { id: ORG.valleCentral, tipo: "proveedor", razonSocial: "Comercial Valle Central SpA", rut: RUT[ORG.valleCentral], nombreFantasia: "Valle Central Mayorista", giro: "Venta al por mayor de abarrotes", emailContacto: "pedidos@vallecentral.test", telefono: "+56 2 2745 3300", direccionId: 3, estado: "activa", ...datosProveedor(ORG.valleCentral, "12:00:00", false, "91.20", "Banco Santander") },
    { id: ORG.frigoSur, tipo: "proveedor", razonSocial: "Frigorífico del Sur S.A.", rut: RUT[ORG.frigoSur], nombreFantasia: "FrigoSur", giro: "Faenadora y distribuidora de carnes y lácteos", emailContacto: "comercial@frigosur.test", telefono: "+56 2 2641 8800", direccionId: 4, estado: "activa", ...datosProveedor(ORG.frigoSur, "13:00:00", true, "94.00", "BancoEstado") },
    { id: ORG.lasPalmas, tipo: "proveedor", razonSocial: "Agrícola Las Palmas Ltda.", rut: RUT[ORG.lasPalmas], nombreFantasia: "Las Palmas", giro: "Producción y venta de frutas y hortalizas", emailContacto: "contacto@laspalmas.test", telefono: "+56 9 8765 4321", direccionId: 5, estado: "en_revision", ...datosProveedor(ORG.lasPalmas, "11:00:00", false, "0.00", "Banco BCI") },
    { id: ORG.elFogon, tipo: "cliente", razonSocial: "Restaurante El Fogón Ltda.", rut: RUT[ORG.elFogon], nombreFantasia: "El Fogón", giro: "Restaurante", emailContacto: "compras@elfogon.test", telefono: "+56 2 2274 5566", direccionId: 6, estado: "activa" },
    { id: ORG.dulceHogar, tipo: "cliente", razonSocial: "Pastelería Dulce Hogar SpA", rut: RUT[ORG.dulceHogar], nombreFantasia: "Dulce Hogar", giro: "Elaboración de productos de pastelería", emailContacto: "compras@dulcehogar.test", telefono: "+56 2 2228 9900", direccionId: 7, estado: "activa" }
  ]);

  await db.insert(schema.rol).values(roles);

  const hashClave = await bcrypt.hash(CLAVE_PRUEBA, 10);
  await db.insert(schema.usuario).values(
    (
      [
        [USR.admin, ORG.cotizapp, ROL.admin, "Administrador Cotizapp", "admin@cotizapp.test", "activo"],
        [USR.editor, ORG.cotizapp, ROL.editor, "Editor de Catálogo", "catalogo@cotizapp.test", "activo"],
        [USR.soporte, ORG.cotizapp, ROL.soporte, "Soporte Cotizapp", "soporte@cotizapp.test", "activo"],
        [USR.losAndes, ORG.losAndes, ROL.proveedor, "Ventas Los Andes", "ventas@losandes.test", "activo"],
        [USR.valleCentral, ORG.valleCentral, ROL.proveedor, "Pedidos Valle Central", "pedidos@vallecentral.test", "activo"],
        [USR.frigoSur, ORG.frigoSur, ROL.proveedor, "Comercial FrigoSur", "comercial@frigosur.test", "activo"],
        [USR.lasPalmas, ORG.lasPalmas, ROL.proveedor, "Contacto Las Palmas", "contacto@laspalmas.test", "invitado"],
        [USR.elFogon, ORG.elFogon, ROL.comprador, "Compras El Fogón", "compras@elfogon.test", "activo"],
        [USR.dulceHogar, ORG.dulceHogar, ROL.comprador, "Compras Dulce Hogar", "compras@dulcehogar.test", "activo"]
      ] as const
    ).map(([id, organizacionId, rolId, nombre, email, estado]) => ({ id, organizacionId, rolId, nombre, email, estado, hashClave }))
  );

  await db.insert(schema.categoria).values(categorias.map((c) => ({ ...c, estado: "activa" as const })));
  await db.insert(schema.producto).values(productos.map((p) => ({ ...p, creadoPor: USR.editor })));

  await db.insert(schema.puntoRetiro).values([
    { id: 1, proveedorId: ORG.losAndes, direccionId: 2, nombre: "Bodega Quilicura", horario: "Lun a Vie 08:00-17:00, Sáb 09:00-13:00" },
    { id: 2, proveedorId: ORG.frigoSur, direccionId: 4, nombre: "Planta Renca", horario: "Lun a Vie 07:30-16:00" }
  ]);

  // comunaId NULL = toda la region.
  await db.insert(schema.proveedorCobertura).values([
    { proveedorId: ORG.losAndes, regionCodigo: "13", comunaId: null, costoDespacho: PROVEEDOR[ORG.losAndes].costoDespachoRM, plazoHoras: 24 },
    { proveedorId: ORG.losAndes, regionCodigo: "05", comunaId: null, costoDespacho: 12990, plazoHoras: 72 },
    { proveedorId: ORG.valleCentral, regionCodigo: "13", comunaId: null, costoDespacho: PROVEEDOR[ORG.valleCentral].costoDespachoRM, plazoHoras: 48 },
    { proveedorId: ORG.frigoSur, regionCodigo: "13", comunaId: null, costoDespacho: PROVEEDOR[ORG.frigoSur].costoDespachoRM, plazoHoras: 24 },
    { proveedorId: ORG.frigoSur, regionCodigo: "08", comunaId: null, costoDespacho: 9990, plazoHoras: 48 },
    { proveedorId: ORG.lasPalmas, regionCodigo: "13", comunaId: comunaId("13119"), costoDespacho: 2990, plazoHoras: 48 },
    { proveedorId: ORG.lasPalmas, regionCodigo: "13", comunaId: comunaId("13102"), costoDespacho: 2990, plazoHoras: 48 },
    { proveedorId: ORG.lasPalmas, regionCodigo: "13", comunaId: comunaId("13106"), costoDespacho: 3490, plazoHoras: 48 }
  ]);

  const documentosDe = (proveedorId: ProveedorId, venceSanitaria: string, revisado: boolean) =>
    (["carpeta_tributaria", "resolucion_sanitaria"] as const).map((tipo) => ({
      proveedorId,
      tipo,
      url: `https://storage.cotizapp.test/proveedores/${proveedorId}/${tipo}.pdf`,
      venceEn: tipo === "resolucion_sanitaria" ? venceSanitaria : null,
      estado: tipo === "resolucion_sanitaria" && new Date(venceSanitaria) < new Date("2026-12-31") ? ("por_vencer" as const) : ("al_dia" as const),
      revisadoPor: revisado ? USR.soporte : null
    }));
  await db
    .insert(schema.proveedorDocumento)
    .values([
      ...documentosDe(ORG.losAndes, "2027-06-30", true),
      ...documentosDe(ORG.valleCentral, "2026-11-15", true),
      ...documentosDe(ORG.frigoSur, "2027-03-31", true),
      ...documentosDe(ORG.lasPalmas, "2027-01-31", false)
    ]);

  await db.insert(schema.oferta).values(ofertas);

  await db.insert(schema.ofertaPrecioHistorial).values([
    { ofertaId: ofertaDe(1, ORG.losAndes).id, precioAnterior: 12990, precioNuevo: 12490, motivo: "Ajuste por volumen de compra", cambiadoPor: USR.losAndes, cambiadoEn: new Date("2026-10-01T09:30:00") },
    { ofertaId: ofertaDe(13, ORG.frigoSur).id, precioAnterior: 6290, precioNuevo: 5990, motivo: "Promoción quincenal", cambiadoPor: USR.frigoSur, cambiadoEn: new Date("2026-10-10T08:00:00") },
    { ofertaId: ofertaDe(16, ORG.valleCentral).id, cajasAnteriores: 12, cajasNuevas: 0, motivo: "Quiebre de stock, oferta pausada", cambiadoPor: USR.valleCentral, cambiadoEn: new Date("2026-10-18T16:45:00") }
  ]);

  await db.insert(schema.carro).values({
    usuarioId: USR.elFogon,
    estado: "abierto",
    items: [ofertaDe(9, ORG.losAndes), ofertaDe(7, ORG.frigoSur), ofertaDe(15, ORG.valleCentral)].map((o, i) => ({
      oferta_id: o.id,
      cantidad: [24, 3, 10][i],
      precio_visto: o.precioUnitario
    }))
  });

  await seedOrdenes(db);

  // Tres sesiones a mano (la de El Fogon termina en la orden CM-10001) +
  // trafico sintetico de septiembre-octubre para los paneles (KAN-143).
  const sesionFogon = { sesionId: "0b6f5f3e-6a1d-4d7e-9a51-3c2f8e1a0001", usuarioId: USR.elFogon, comunaId: comunaId("13120") };
  const sesionAnonima = { sesionId: "4c1d2e3f-7b8a-4c9d-8e0f-1a2b3c4d0002", comunaId: comunaId("13114") };
  await db.insert(schema.eventoAnalitico).values([
    { ...sesionFogon, tipoEvento: "busqueda", termino: "aceite", resultados: 2, creadoEn: new Date("2026-10-06T10:02:00") },
    { ...sesionFogon, tipoEvento: "vista_producto", productoId: 1, origen: "busqueda", creadoEn: new Date("2026-10-06T10:03:00") },
    { ...sesionFogon, tipoEvento: "click_oferta", productoId: 1, ofertaId: ofertaDe(1, ORG.losAndes).id, convirtio: 1, creadoEn: new Date("2026-10-06T10:05:00") },
    { ...sesionAnonima, tipoEvento: "vista_producto", productoId: 5, origen: "catalogo", creadoEn: new Date("2026-10-08T15:20:00") },
    { ...sesionAnonima, tipoEvento: "click_oferta", productoId: 5, ofertaId: ofertaDe(5, ORG.valleCentral).id, convirtio: 0, creadoEn: new Date("2026-10-08T15:21:00") },
    { tipoEvento: "busqueda", sesionId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c0003", termino: "harina integral", resultados: 0, creadoEn: new Date("2026-10-09T09:40:00") }
  ]);
  const sinteticos = eventosSinteticos();
  for (let k = 0; k < sinteticos.length; k += 500) {
    await db.insert(schema.eventoAnalitico).values(sinteticos.slice(k, k + 500));
  }

  await db.insert(schema.auditoriaLog).values([
    ...[ORG.losAndes, ORG.valleCentral, ORG.frigoSur].map((id) => ({
      usuarioId: USR.admin,
      entidad: "organizacion",
      entidadId: id,
      accion: "aprobar" as const,
      datosAntes: { estado: "en_revision" },
      datosDespues: { estado: "activa" }
    })),
    { usuarioId: USR.editor, entidad: "producto", entidadId: 1, accion: "crear" as const, datosDespues: { sku: "ACE-0001", estado: "publicado" } }
  ]);

  await db.insert(schema.moderacionCaso).values([
    { tipo: "alta_proveedor", entidad: "organizacion", entidadId: ORG.lasPalmas, detalle: "Solicitud de alta pendiente de revisión documental", asignadoA: USR.soporte },
    { tipo: "precio_fuera_rango", entidad: "oferta", entidadId: ofertaDe(14, ORG.lasPalmas).id, detalle: "Precio $7.490 supera en más de 30% la referencia de $4.990" }
  ]);
}


const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// Lunes 00:00 UTC de la semana (lun-dom) de una fecha: los cortes de
// liquidacion son semanales. En UTC porque Drizzle guarda los datetime en
// UTC (asi el corte coincide con lo que agrupa SQL) y para no depender del
// cambio de horario de Chile (p. ej. 2026-09-06, que no tiene 00:00 local).
function inicioSemana(fecha: Date): Date {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

// Ordenes multiproveedor. Las 1 y 2 son las originales (los frontends las
// conocen por id); de la 3 a la 10 son historial entregado de septiembre y
// octubre para que el panel del proveedor y los promedios de calificacion
// (KAN-142) tengan volumen creible; la 11 esta recien pagada.
async function seedOrdenes(db: Db) {
  const productoPorId = new Map<number, (typeof productos)[number]>(productos.map((p) => [p.id, p]));

  type EnvioEstado = "por_despachar" | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado";
  type EnvioDef = {
    proveedorId: ProveedorId;
    modalidad: "despacho" | "retiro";
    puntoRetiroId?: number;
    estado: EnvioEstado;
    lineas: [productoId: number, cantidad: number][];
    // Solo envios entregados. Sin calificacion = el cliente aun no califica.
    calificacion?: [puntaje: number, comentario: string | null];
  };
  type OrdenDef = {
    id: number;
    codigo: string;
    cliente: typeof ORG.elFogon | typeof ORG.dulceHogar;
    estado: "pendiente_pago" | "pagada" | "en_preparacion" | "despachada" | "entregada" | "reembolsada";
    medioPago: "tarjeta" | "transferencia" | "linea_credito";
    creadaEn: Date;
    envios: EnvioDef[];
  };

  // El usuario comprador y la direccion de entrega de cada cliente. Dulce
  // Hogar siempre pide factura.
  const CLIENTE = {
    [ORG.elFogon]: { usuarioId: USR.elFogon, direccionEntregaId: 6, requiereFactura: false },
    [ORG.dulceHogar]: { usuarioId: USR.dulceHogar, direccionEntregaId: 7, requiereFactura: true }
  };

  const ordenes: OrdenDef[] = [
    {
      id: 1,
      codigo: "CM-10001",
      cliente: ORG.elFogon,
      estado: "entregada",
      medioPago: "tarjeta",
      creadaEn: new Date("2026-10-06T10:15:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", estado: "entregado", lineas: [[1, 4], [3, 3], [11, 2]], calificacion: [5, "Llegó todo antes de la hora de corte y bien embalado."] },
        { proveedorId: ORG.frigoSur, modalidad: "despacho", estado: "entregado", lineas: [[12, 10], [13, 8]], calificacion: [4, "Buena cadena de frío; el camión llegó una hora tarde."] }
      ]
    },
    {
      id: 2,
      codigo: "CM-10002",
      cliente: ORG.dulceHogar,
      estado: "en_preparacion",
      medioPago: "transferencia",
      creadaEn: new Date("2026-10-20T17:40:00"),
      envios: [
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "en_preparacion", lineas: [[5, 2], [6, 1], [10, 6]] },
        { proveedorId: ORG.losAndes, modalidad: "retiro", puntoRetiroId: 1, estado: "listo_retiro", lineas: [[11, 5]] }
      ]
    },
    {
      id: 3,
      codigo: "CM-10003",
      cliente: ORG.elFogon,
      estado: "entregada",
      medioPago: "tarjeta",
      creadaEn: new Date("2026-09-01T09:20:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", estado: "entregado", lineas: [[2, 6], [4, 10], [9, 24]], calificacion: [5, null] },
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[8, 4], [14, 6]], calificacion: [4, "Paltas en buen punto."] }
      ]
    },
    {
      id: 4,
      codigo: "CM-10004",
      cliente: ORG.dulceHogar,
      estado: "entregada",
      medioPago: "transferencia",
      creadaEn: new Date("2026-09-04T15:05:00"),
      envios: [
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[3, 5], [15, 36]], calificacion: [3, "Llegaron 4 kg de tomate machucados, reclamo resuelto con nota de crédito."] },
        { proveedorId: ORG.frigoSur, modalidad: "despacho", estado: "entregado", lineas: [[7, 4], [10, 12]], calificacion: [5, "Crema con buena fecha de vencimiento."] }
      ]
    },
    {
      id: 5,
      codigo: "CM-10005",
      cliente: ORG.elFogon,
      estado: "entregada",
      medioPago: "linea_credito",
      creadaEn: new Date("2026-09-10T11:40:00"),
      envios: [
        { proveedorId: ORG.frigoSur, modalidad: "despacho", estado: "entregado", lineas: [[12, 6], [13, 10]], calificacion: [4, null] },
        { proveedorId: ORG.losAndes, modalidad: "retiro", puntoRetiroId: 1, estado: "entregado", lineas: [[1, 3], [17, 2]], calificacion: [4, "Retiro rápido, pero hubo fila en la bodega."] }
      ]
    },
    {
      id: 6,
      codigo: "CM-10006",
      cliente: ORG.dulceHogar,
      estado: "entregada",
      medioPago: "transferencia",
      creadaEn: new Date("2026-09-16T08:55:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", estado: "entregado", lineas: [[5, 2], [11, 4]], calificacion: [5, "Siempre puntuales."] },
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[6, 2], [9, 24]], calificacion: [4, null] }
      ]
    },
    {
      id: 7,
      codigo: "CM-10007",
      cliente: ORG.elFogon,
      estado: "entregada",
      medioPago: "tarjeta",
      creadaEn: new Date("2026-09-23T10:30:00"),
      envios: [
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[1, 4], [10, 6], [4, 12]], calificacion: [5, "Despacho gratis y a tiempo."] },
        { proveedorId: ORG.frigoSur, modalidad: "retiro", puntoRetiroId: 2, estado: "entregado", lineas: [[8, 6], [9, 36]], calificacion: [5, null] }
      ]
    },
    {
      id: 8,
      codigo: "CM-10008",
      cliente: ORG.dulceHogar,
      estado: "entregada",
      medioPago: "transferencia",
      creadaEn: new Date("2026-09-29T16:10:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", estado: "entregado", lineas: [[3, 4], [16, 6]], calificacion: [4, "Faltó una botella; la repusieron al día siguiente."] },
        { proveedorId: ORG.frigoSur, modalidad: "despacho", estado: "entregado", lineas: [[13, 12]], calificacion: [4, null] }
      ]
    },
    {
      id: 9,
      codigo: "CM-10009",
      cliente: ORG.elFogon,
      estado: "entregada",
      medioPago: "tarjeta",
      creadaEn: new Date("2026-10-13T09:45:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", estado: "entregado", lineas: [[1, 5], [2, 4]], calificacion: [5, null] },
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[11, 3], [5, 1]], calificacion: [3, "Llegó al día siguiente de lo prometido."] }
      ]
    },
    {
      id: 10,
      codigo: "CM-10010",
      cliente: ORG.dulceHogar,
      estado: "entregada",
      medioPago: "transferencia",
      creadaEn: new Date("2026-10-14T12:20:00"),
      // Entregada hace pocos dias y sin calificar todavia.
      envios: [
        { proveedorId: ORG.frigoSur, modalidad: "despacho", estado: "entregado", lineas: [[7, 6], [12, 4]] },
        { proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "entregado", lineas: [[15, 24], [14, 4]] }
      ]
    },
    {
      id: 11,
      codigo: "CM-10011",
      cliente: ORG.elFogon,
      estado: "pagada",
      medioPago: "tarjeta",
      creadaEn: new Date("2026-10-21T18:05:00"),
      envios: [{ proveedorId: ORG.valleCentral, modalidad: "despacho", estado: "por_despachar", lineas: [[3, 2], [4, 6]] }]
    }
  ];

  let envioId = 0;
  const filasEnvio: (typeof schema.ordenEnvio.$inferInsert)[] = [];
  const filasLinea: (typeof schema.ordenLinea.$inferInsert)[] = [];
  const filasOrden: (typeof schema.orden.$inferInsert)[] = [];
  const filasCalificacion: (typeof schema.calificacion.$inferInsert)[] = [];

  for (const o of ordenes) {
    const cliente = CLIENTE[o.cliente];
    let subtotalOrden = 0;
    let despachoOrden = 0;
    let comisionOrden = 0;

    for (const e of o.envios) {
      envioId += 1;
      let subtotal = 0;
      for (const [productoId, cantidad] of e.lineas) {
        const oferta = ofertaDe(productoId, e.proveedorId);
        const producto = productoPorId.get(productoId)!;
        const totalLinea = oferta.precioUnitario * cantidad;
        subtotal += totalLinea;
        filasLinea.push({
          ordenEnvioId: envioId,
          ofertaId: oferta.id,
          productoId,
          nombreProducto: producto.nombre,
          formato: producto.formato,
          precioUnitario: oferta.precioUnitario,
          cantidad,
          totalLinea
        });
      }
      const p = PROVEEDOR[e.proveedorId];
      // Retiro no paga despacho; despacho es gratis sobre el umbral del proveedor.
      const costoDespacho = e.modalidad === "retiro" || subtotal >= p.gratisDesde ? 0 : p.costoDespachoRM;
      const comisionMonto = Math.round((subtotal * p.comisionPct) / 100);
      const entregadoEn = new Date(o.creadaEn.getTime() + p.plazoHoras * HORA);
      filasEnvio.push({
        id: envioId,
        ordenId: o.id,
        proveedorId: e.proveedorId,
        modalidad: e.modalidad,
        puntoRetiroId: e.puntoRetiroId ?? null,
        direccionEntregaId: e.modalidad === "despacho" ? cliente.direccionEntregaId : null,
        plazoHoras: p.plazoHoras,
        costoDespacho,
        subtotal,
        comisionPct: p.comisionPct.toFixed(2),
        comisionMonto,
        estado: e.estado,
        actualizadoEn: e.estado === "entregado" ? entregadoEn : new Date(o.creadaEn.getTime() + 2 * HORA)
      });
      if (e.calificacion) {
        const [puntaje, comentario] = e.calificacion;
        filasCalificacion.push({
          ordenEnvioId: envioId,
          usuarioId: cliente.usuarioId,
          puntaje,
          comentario,
          creadaEn: new Date(entregadoEn.getTime() + DIA + (envioId % 5) * HORA)
        });
      }
      subtotalOrden += subtotal;
      despachoOrden += costoDespacho;
      comisionOrden += comisionMonto;
    }

    filasOrden.push({
      id: o.id,
      codigo: o.codigo,
      usuarioId: cliente.usuarioId,
      organizacionId: o.cliente,
      direccionEntregaId: cliente.direccionEntregaId,
      subtotal: subtotalOrden,
      costoDespachoTotal: despachoOrden,
      comisionTotal: comisionOrden,
      total: subtotalOrden + despachoOrden,
      requiereFactura: cliente.requiereFactura ? 1 : 0,
      estado: o.estado,
      medioPago: o.medioPago,
      estadoPago: "pagado",
      referenciaPasarela: `SIM-${o.codigo}`,
      creadaEn: o.creadaEn,
      pagadoEn: new Date(o.creadaEn.getTime() + 2 * 60 * 1000)
    });
  }

  await db.insert(schema.orden).values(filasOrden);

  // Corte semanal (lun-dom) por proveedor de lo entregado, pagado el martes
  // siguiente. El corte de la semana mas reciente queda pendiente de pago.
  const entregados = filasEnvio.filter((e) => e.estado === "entregado");
  const cortes = new Map<string, { proveedorId: number; desde: Date; envios: typeof entregados }>();
  for (const e of entregados) {
    const desde = inicioSemana(e.actualizadoEn as Date);
    const clave = `${desde.getTime()}-${e.proveedorId}`;
    if (!cortes.has(clave)) cortes.set(clave, { proveedorId: e.proveedorId, desde, envios: [] });
    cortes.get(clave)!.envios.push(e);
  }
  const ultimoCorte = Math.max(...[...cortes.values()].map((c) => c.desde.getTime()));
  const liquidaciones = [...cortes.values()]
    .sort((a, b) => a.desde.getTime() - b.desde.getTime() || a.proveedorId - b.proveedorId)
    .map((c, i) => {
      const id = i + 1;
      let montoBruto = 0;
      let comision = 0;
      for (const e of c.envios) {
        const bruto = e.subtotal + (e.costoDespacho ?? 0);
        Object.assign(e, {
          liquidacionId: id,
          montoBrutoLiquidado: bruto,
          comisionLiquidada: e.comisionMonto,
          montoNetoLiquidado: bruto - e.comisionMonto
        });
        montoBruto += bruto;
        comision += e.comisionMonto;
      }
      const pagada = c.desde.getTime() !== ultimoCorte;
      return {
        id,
        proveedorId: c.proveedorId,
        periodoDesde: soloFecha(c.desde),
        periodoHasta: soloFecha(new Date(c.desde.getTime() + 6 * DIA)),
        montoBruto,
        comision,
        montoNeto: montoBruto - comision,
        estado: pagada ? ("pagada" as const) : ("pendiente" as const),
        // Martes siguiente, 14:00 UTC (11:00 en Chile).
        pagadaEn: pagada ? new Date(c.desde.getTime() + 8 * DIA + 14 * HORA) : null
      };
    });
  await db.insert(schema.liquidacion).values(liquidaciones);

  await db.insert(schema.ordenEnvio).values(filasEnvio);
  await db.insert(schema.ordenLinea).values(filasLinea);
  await db.insert(schema.calificacion).values(filasCalificacion);

  // Guia de despacho (52) de cada envio entregado, emitida por el proveedor
  // con folio correlativo propio, + factura (33) de las ordenes que la
  // pidieron. Montos con IVA incluido.
  const conIva = (total: number) => ({ neto: Math.round(total / 1.19), iva: total - Math.round(total / 1.19), total });
  const ordenPorId = new Map(filasOrden.map((o) => [o.id!, o]));
  const folioGuia = new Map<number, number>();
  const guias = entregados.map((e) => {
    const folio = (folioGuia.get(e.proveedorId) ?? 1000) + 1;
    folioGuia.set(e.proveedorId, folio);
    return {
      tipoDte: 52,
      folio,
      ordenEnvioId: e.id!,
      emisorRut: RUT[e.proveedorId as ProveedorId],
      receptorRut: RUT[ordenPorId.get(e.ordenId)!.organizacionId as keyof typeof RUT],
      ...conIva(e.subtotal + (e.costoDespacho ?? 0)),
      estadoSii: "aceptado" as const,
      emitidoEn: new Date((e.actualizadoEn as Date).getTime() - 3 * HORA)
    };
  });
  const facturas = filasOrden
    .filter((o) => o.requiereFactura)
    .map((o, i) => ({
      tipoDte: 33,
      folio: 5001 + i,
      ordenId: o.id!,
      emisorRut: RUT[ORG.cotizapp],
      receptorRut: RUT[o.organizacionId as keyof typeof RUT],
      ...conIva(o.total),
      estadoSii: o.estado === "entregada" ? ("aceptado" as const) : ("pendiente" as const),
      emitidoEn: new Date(o.creadaEn!.getTime() + 5 * 60 * 1000)
    }));
  await db.insert(schema.documentoTributario).values([...guias, ...facturas]);
}

// Generador pseudoaleatorio con semilla fija (mulberry32): el seed produce
// siempre los mismos eventos, asi los tests y las demos son reproducibles.
function generador(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Trafico del catalogo entre el 1 de septiembre y el 22 de octubre de 2026:
// sesiones que ven productos, hacen click en una oferta publicada (la mas
// barata con mas probabilidad) y a veces convierten, mas busquedas con y
// sin resultados. Los productos de uso diario tienen mas vistas.
function eventosSinteticos(): (typeof schema.eventoAnalitico.$inferInsert)[] {
  const azar = generador(20261023);
  const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)]!;
  const uuid = () =>
    "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(azar() * 16).toString(16));

  const POPULARES = new Set([1, 3, 9, 11, 13]);
  const COMUNAS = ["13101", "13114", "13119", "13120", "13123", "13125", "13110", "13201"].map(comunaId);
  const BUSQUEDAS: [termino: string, resultados: number][] = [
    ["aceite", 2], ["arroz", 1], ["queso", 2], ["pollo", 1], ["leche", 1], ["huevos", 1], ["palta", 1],
    ["harina integral", 0], ["leche sin lactosa", 0], ["levadura", 0], ["mantequilla", 0]
  ];
  const publicadas = ofertas.filter((o) => o.estado === "publicada");

  const eventos: (typeof schema.eventoAnalitico.$inferInsert)[] = [];
  for (let dia = new Date("2026-09-01T00:00:00Z"); dia < new Date("2026-10-23T00:00:00Z"); dia = new Date(dia.getTime() + DIA)) {
    const finDeSemana = dia.getUTCDay() === 0 || dia.getUTCDay() === 6;
    const sesiones = (finDeSemana ? 6 : 14) + Math.floor(azar() * 6);
    for (let n = 0; n < sesiones; n++) {
      // Horario comercial de Chile (11:00-23:00 UTC = 08:00-20:00 local).
      let t = dia.getTime() + (11 + azar() * 12) * HORA;
      const sesion = {
        sesionId: uuid(),
        usuarioId: azar() < 0.2 ? elegir([USR.elFogon, USR.dulceHogar]) : null,
        comunaId: elegir(COMUNAS)
      };
      const evento = (e: Omit<typeof schema.eventoAnalitico.$inferInsert, "sesionId">) => {
        t += (1 + azar() * 4) * 60 * 1000;
        eventos.push({ ...sesion, ...e, creadoEn: new Date(t) });
      };

      const busco = azar() < 0.4;
      if (busco) {
        const [termino, resultados] = elegir(BUSQUEDAS);
        evento({ tipoEvento: "busqueda", termino, resultados });
        if (resultados === 0) continue;
      }
      const vistas = 1 + Math.floor(azar() * 3);
      for (let v = 0; v < vistas; v++) {
        const productoId = azar() < 0.55 ? elegir([...POPULARES]) : 1 + Math.floor(azar() * productos.length);
        evento({ tipoEvento: "vista_producto", productoId, origen: busco && v === 0 ? "busqueda" : elegir(["catalogo", "catalogo", "directo"] as const) });

        const delProducto = publicadas.filter((o) => o.productoId === productoId).sort((a, b) => a.precioUnitario - b.precioUnitario);
        if (delProducto.length === 0 || azar() >= 0.35) continue;
        const oferta = azar() < 0.6 ? delProducto[0]! : elegir(delProducto);
        evento({ tipoEvento: "click_oferta", productoId, ofertaId: oferta.id, convirtio: azar() < 0.2 ? 1 : 0 });
      }
    }
  }
  return eventos;
}
