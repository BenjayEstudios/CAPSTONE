import bcrypt from "bcryptjs";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "../schema/index.js";
import { categorias, comunaId, comunas, productos, ROL, roles } from "./catalogo.js";

type Db = MySql2Database<typeof schema>;

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
const PROVEEDOR = {
  [ORG.losAndes]: { comisionPct: 8, plazoHoras: 24, gratisDesde: 150000, modalidad: "ambos" },
  [ORG.valleCentral]: { comisionPct: 7.5, plazoHoras: 48, gratisDesde: 200000, modalidad: "despacho" },
  [ORG.frigoSur]: { comisionPct: 9, plazoHoras: 24, gratisDesde: 120000, modalidad: "ambos" },
  [ORG.lasPalmas]: { comisionPct: 8, plazoHoras: 48, gratisDesde: 80000, modalidad: "despacho" }
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
    ofreceDespacho: true,
    ofreceRetiro,
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
    { proveedorId: ORG.losAndes, regionCodigo: "13", comunaId: null, costoDespacho: 4990, plazoHoras: 24 },
    { proveedorId: ORG.losAndes, regionCodigo: "05", comunaId: null, costoDespacho: 12990, plazoHoras: 72 },
    { proveedorId: ORG.valleCentral, regionCodigo: "13", comunaId: null, costoDespacho: 5990, plazoHoras: 48 },
    { proveedorId: ORG.frigoSur, regionCodigo: "13", comunaId: null, costoDespacho: 6990, plazoHoras: 24 },
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
      venceEn: tipo === "resolucion_sanitaria" ? new Date(venceSanitaria) : null,
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

  await db.insert(schema.eventoAnalitico).values([
    { tipoEvento: "busqueda", sesionId: "0b6f5f3e-6a1d-4d7e-9a51-3c2f8e1a0001", usuarioId: USR.elFogon, comunaId: comunaId("13120"), termino: "aceite", resultados: 2 },
    { tipoEvento: "vista_producto", sesionId: "0b6f5f3e-6a1d-4d7e-9a51-3c2f8e1a0001", usuarioId: USR.elFogon, comunaId: comunaId("13120"), productoId: 1, origen: "busqueda" },
    { tipoEvento: "click_oferta", sesionId: "0b6f5f3e-6a1d-4d7e-9a51-3c2f8e1a0001", usuarioId: USR.elFogon, comunaId: comunaId("13120"), productoId: 1, ofertaId: ofertaDe(1, ORG.losAndes).id, convirtio: true },
    { tipoEvento: "vista_producto", sesionId: "4c1d2e3f-7b8a-4c9d-8e0f-1a2b3c4d0002", comunaId: comunaId("13114"), productoId: 5, origen: "catalogo" },
    { tipoEvento: "click_oferta", sesionId: "4c1d2e3f-7b8a-4c9d-8e0f-1a2b3c4d0002", comunaId: comunaId("13114"), productoId: 5, ofertaId: ofertaDe(5, ORG.valleCentral).id, convirtio: false },
    { tipoEvento: "busqueda", sesionId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c0003", termino: "harina integral", resultados: 0 }
  ]);

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

// Dos ordenes multiproveedor: una entregada y liquidada, otra en curso con
// un tramo de despacho y otro de retiro.
async function seedOrdenes(db: Db) {
  const productoPorId = new Map<number, (typeof productos)[number]>(productos.map((p) => [p.id, p]));

  type EnvioDef = {
    proveedorId: ProveedorId;
    modalidad: "despacho" | "retiro";
    puntoRetiroId?: number;
    costoDespacho: number;
    estado: "por_despachar" | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado";
    lineas: [productoId: number, cantidad: number][];
  };
  type OrdenDef = {
    id: number;
    codigo: string;
    usuarioId: number;
    organizacionId: number;
    direccionEntregaId: number;
    estado: "pendiente_pago" | "pagada" | "en_preparacion" | "despachada" | "entregada" | "reembolsada";
    medioPago: "tarjeta" | "transferencia" | "linea_credito";
    requiereFactura: boolean;
    creadaEn: Date;
    envios: EnvioDef[];
  };

  const ordenes: OrdenDef[] = [
    {
      id: 1,
      codigo: "CM-10001",
      usuarioId: USR.elFogon,
      organizacionId: ORG.elFogon,
      direccionEntregaId: 6,
      estado: "entregada",
      medioPago: "tarjeta",
      requiereFactura: false,
      creadaEn: new Date("2026-10-06T10:15:00"),
      envios: [
        { proveedorId: ORG.losAndes, modalidad: "despacho", costoDespacho: 4990, estado: "entregado", lineas: [[1, 4], [3, 3], [11, 2]] },
        { proveedorId: ORG.frigoSur, modalidad: "despacho", costoDespacho: 0, estado: "entregado", lineas: [[12, 10], [13, 8]] }
      ]
    },
    {
      id: 2,
      codigo: "CM-10002",
      usuarioId: USR.dulceHogar,
      organizacionId: ORG.dulceHogar,
      direccionEntregaId: 7,
      estado: "en_preparacion",
      medioPago: "transferencia",
      requiereFactura: true,
      creadaEn: new Date("2026-10-20T17:40:00"),
      envios: [
        { proveedorId: ORG.valleCentral, modalidad: "despacho", costoDespacho: 5990, estado: "en_preparacion", lineas: [[5, 2], [6, 1], [10, 6]] },
        { proveedorId: ORG.losAndes, modalidad: "retiro", puntoRetiroId: 1, costoDespacho: 0, estado: "listo_retiro", lineas: [[11, 5]] }
      ]
    }
  ];

  let envioId = 0;
  const filasEnvio: (typeof schema.ordenEnvio.$inferInsert)[] = [];
  const filasLinea: (typeof schema.ordenLinea.$inferInsert)[] = [];
  const filasOrden: (typeof schema.orden.$inferInsert)[] = [];

  for (const o of ordenes) {
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
      const comisionPct = PROVEEDOR[e.proveedorId].comisionPct;
      const comisionMonto = Math.round((subtotal * comisionPct) / 100);
      filasEnvio.push({
        id: envioId,
        ordenId: o.id,
        proveedorId: e.proveedorId,
        modalidad: e.modalidad,
        puntoRetiroId: e.puntoRetiroId ?? null,
        direccionEntregaId: e.modalidad === "despacho" ? o.direccionEntregaId : null,
        plazoHoras: PROVEEDOR[e.proveedorId].plazoHoras,
        costoDespacho: e.costoDespacho,
        subtotal,
        comisionPct: comisionPct.toFixed(2),
        comisionMonto,
        estado: e.estado
      });
      subtotalOrden += subtotal;
      despachoOrden += e.costoDespacho;
      comisionOrden += comisionMonto;
    }

    filasOrden.push({
      id: o.id,
      codigo: o.codigo,
      usuarioId: o.usuarioId,
      organizacionId: o.organizacionId,
      direccionEntregaId: o.direccionEntregaId,
      subtotal: subtotalOrden,
      costoDespachoTotal: despachoOrden,
      comisionTotal: comisionOrden,
      total: subtotalOrden + despachoOrden,
      requiereFactura: o.requiereFactura,
      estado: o.estado,
      medioPago: o.medioPago,
      estadoPago: "pagado",
      referenciaPasarela: `SIM-${o.codigo}`,
      creadaEn: o.creadaEn,
      pagadoEn: new Date(o.creadaEn.getTime() + 2 * 60 * 1000)
    });
  }

  await db.insert(schema.orden).values(filasOrden);

  // Los envios entregados de la orden 1 entran al corte semanal del
  // 05-11 de octubre, pagado el martes siguiente.
  const liquidados = filasEnvio.filter((e) => e.estado === "entregado");
  const liquidaciones = liquidados.map((e, i) => {
    const montoBruto = e.subtotal + (e.costoDespacho ?? 0);
    return {
      id: i + 1,
      proveedorId: e.proveedorId,
      periodoDesde: new Date("2026-10-05"),
      periodoHasta: new Date("2026-10-11"),
      montoBruto,
      comision: e.comisionMonto,
      montoNeto: montoBruto - e.comisionMonto,
      estado: "pagada" as const,
      pagadaEn: new Date("2026-10-13T11:00:00")
    };
  });
  await db.insert(schema.liquidacion).values(liquidaciones);
  liquidados.forEach((e, i) => {
    Object.assign(e, {
      liquidacionId: liquidaciones[i]!.id,
      montoBrutoLiquidado: liquidaciones[i]!.montoBruto,
      comisionLiquidada: liquidaciones[i]!.comision,
      montoNetoLiquidado: liquidaciones[i]!.montoNeto
    });
  });

  await db.insert(schema.ordenEnvio).values(filasEnvio);
  await db.insert(schema.ordenLinea).values(filasLinea);

  // Guias de despacho (52) de los envios entregados + factura (33) de la
  // orden 2, que la pidio. Montos con IVA incluido.
  const conIva = (total: number) => ({ neto: Math.round(total / 1.19), iva: total - Math.round(total / 1.19), total });
  await db.insert(schema.documentoTributario).values([
    ...liquidados.map((e, i) => ({
      tipoDte: 52,
      folio: 1001 + i,
      ordenEnvioId: e.id!,
      emisorRut: RUT[e.proveedorId as ProveedorId],
      receptorRut: RUT[ORG.elFogon],
      ...conIva(e.subtotal + (e.costoDespacho ?? 0)),
      estadoSii: "aceptado" as const,
      emitidoEn: new Date("2026-10-07T09:00:00")
    })),
    {
      tipoDte: 33,
      folio: 5001,
      ordenId: 2,
      emisorRut: RUT[ORG.cotizapp],
      receptorRut: RUT[ORG.dulceHogar],
      ...conIva(filasOrden[1]!.total),
      estadoSii: "pendiente" as const,
      emitidoEn: new Date("2026-10-20T17:45:00")
    }
  ]);
}
