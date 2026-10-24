// Datos de referencia estaticos del seed: geografia, roles y catalogo
// maestro. Los IDs son explicitos para que el resto del seed (y quien
// pruebe los frontends) pueda referirse a ellos de forma estable.

// Subconjunto de comunas (codigo CUT oficial). Cubre la provincia de
// Santiago completa + Puente Alto y algunas comunas de V y VIII region para
// probar cobertura fuera de la RM. No es el listado nacional completo.
const RM = { regionCodigo: "13", regionNombre: "Metropolitana de Santiago", regionOrden: 7 };
const VALPO = { regionCodigo: "05", regionNombre: "Valparaíso", regionOrden: 6 };
const BIOBIO = { regionCodigo: "08", regionNombre: "Biobío", regionOrden: 11 };

export const comunas = [
  ["13101", "Santiago", RM],
  ["13102", "Cerrillos", RM],
  ["13103", "Cerro Navia", RM],
  ["13104", "Conchalí", RM],
  ["13105", "El Bosque", RM],
  ["13106", "Estación Central", RM],
  ["13107", "Huechuraba", RM],
  ["13108", "Independencia", RM],
  ["13109", "La Cisterna", RM],
  ["13110", "La Florida", RM],
  ["13111", "La Granja", RM],
  ["13112", "La Pintana", RM],
  ["13113", "La Reina", RM],
  ["13114", "Las Condes", RM],
  ["13115", "Lo Barnechea", RM],
  ["13116", "Lo Espejo", RM],
  ["13117", "Lo Prado", RM],
  ["13118", "Macul", RM],
  ["13119", "Maipú", RM],
  ["13120", "Ñuñoa", RM],
  ["13121", "Pedro Aguirre Cerda", RM],
  ["13122", "Peñalolén", RM],
  ["13123", "Providencia", RM],
  ["13124", "Pudahuel", RM],
  ["13125", "Quilicura", RM],
  ["13126", "Quinta Normal", RM],
  ["13127", "Recoleta", RM],
  ["13128", "Renca", RM],
  ["13129", "San Joaquín", RM],
  ["13130", "San Miguel", RM],
  ["13131", "San Ramón", RM],
  ["13132", "Vitacura", RM],
  ["13201", "Puente Alto", RM],
  ["05101", "Valparaíso", VALPO],
  ["05109", "Viña del Mar", VALPO],
  ["08101", "Concepción", BIOBIO],
  ["08110", "Talcahuano", BIOBIO]
].map(([codigo, nombre, region], i) => ({
  id: i + 1,
  codigo: codigo as string,
  nombre: nombre as string,
  ...(region as typeof RM)
}));

// id de comuna a partir del codigo CUT, para no depender del orden del arreglo.
export function comunaId(codigo: string): number {
  const found = comunas.find((c) => c.codigo === codigo);
  if (!found) throw new Error(`Comuna ${codigo} no esta en el seed`);
  return found.id;
}

// Catalogo de codigos de permiso (ver nota de rol en DataBase/dbDiagram.sql).
const PERMISOS = [
  "crear_producto",
  "cargar_imagenes",
  "aprobar_proveedor",
  "ver_todas_ordenes",
  "ver_ordenes_propias",
  "publicar_precio_stock",
  "emitir_reembolso",
  "liquidar_proveedor",
  "crear_usuario",
  "cambiar_permisos",
  "ver_auditoria"
] as const;

type Nivel = "ninguno" | "parcial" | "total";

function matriz(niveles: Partial<Record<(typeof PERMISOS)[number], Nivel>>) {
  return Object.fromEntries(PERMISOS.map((p) => [p, niveles[p] ?? "ninguno"]));
}

export const ROL = { admin: 1, editor: 2, soporte: 3, proveedor: 4, comprador: 5 } as const;

export const roles = [
  {
    id: ROL.admin,
    codigo: "admin_general",
    nombre: "Administrador general",
    descripcion: "Acceso total al panel de administración",
    esSistema: true,
    permisos: matriz(Object.fromEntries(PERMISOS.map((p) => [p, "total"])))
  },
  {
    id: ROL.editor,
    codigo: "editor_catalogo",
    nombre: "Editor de catálogo",
    descripcion: "Crea y edita fichas de producto del catálogo maestro",
    esSistema: true,
    permisos: matriz({ crear_producto: "total", cargar_imagenes: "total", ver_auditoria: "parcial" })
  },
  {
    id: ROL.soporte,
    codigo: "soporte",
    nombre: "Soporte",
    descripcion: "Atiende órdenes, reembolsos y altas de proveedor",
    esSistema: true,
    permisos: matriz({
      aprobar_proveedor: "total",
      ver_todas_ordenes: "total",
      emitir_reembolso: "parcial",
      ver_auditoria: "parcial"
    })
  },
  {
    id: ROL.proveedor,
    codigo: "proveedor",
    nombre: "Proveedor",
    descripcion: "Distribuidor: publica precio y stock, ve sus propias órdenes",
    esSistema: true,
    permisos: matriz({ ver_ordenes_propias: "total", publicar_precio_stock: "total", cargar_imagenes: "parcial" })
  },
  {
    id: ROL.comprador,
    codigo: "comprador",
    nombre: "Comprador",
    descripcion: "Cliente: compara, arma carro multiproveedor y paga",
    esSistema: true,
    permisos: matriz({ ver_ordenes_propias: "total" })
  }
];

// Arbol de 2 niveles: raices sin padre, subcategorias con padreId.
export const categorias = [
  { id: 1, padreId: null, nombre: "Abarrotes", slug: "abarrotes", orden: 1 },
  { id: 2, padreId: null, nombre: "Lácteos y huevos", slug: "lacteos-y-huevos", orden: 2 },
  { id: 3, padreId: null, nombre: "Carnes", slug: "carnes", orden: 3 },
  { id: 4, padreId: null, nombre: "Frutas y verduras", slug: "frutas-y-verduras", orden: 4 },
  { id: 5, padreId: null, nombre: "Bebidas", slug: "bebidas", orden: 5 },
  { id: 6, padreId: null, nombre: "Panadería y pastelería", slug: "panaderia-y-pasteleria", orden: 6 },
  { id: 7, padreId: null, nombre: "Aseo y desechables", slug: "aseo-y-desechables", orden: 7 },
  { id: 8, padreId: 1, nombre: "Aceites", slug: "aceites", orden: 1 },
  { id: 9, padreId: 1, nombre: "Arroz y legumbres", slug: "arroz-y-legumbres", orden: 2 },
  { id: 10, padreId: 2, nombre: "Quesos", slug: "quesos", orden: 1 },
  { id: 11, padreId: 2, nombre: "Leches y cremas", slug: "leches-y-cremas", orden: 2 },
  { id: 12, padreId: 3, nombre: "Vacuno", slug: "vacuno", orden: 1 },
  { id: 13, padreId: 3, nombre: "Pollo", slug: "pollo", orden: 2 },
  { id: 14, padreId: 6, nombre: "Harinas", slug: "harinas", orden: 1 },
  { id: 15, padreId: 6, nombre: "Azúcar y endulzantes", slug: "azucar-y-endulzantes", orden: 2 }
];

// Fichas del catalogo maestro. precioReferencia en CLP por unidad de venta
// (el "formato"); topeSobreReferenciaPct marca el maximo aceptado antes de
// abrir un caso de moderacion por precio fuera de rango. imagenes queda en
// NULL hasta que se defina el almacenamiento (KAN-157).
type Unidad = "kg" | "L" | "unidad";

export const productos = (
  [
    [1, 8, "ACE-0001", "Aceite vegetal maravilla", "Belmont", "Bidón 5 L", "5", "L", 12990],
    [2, 8, "ACE-0002", "Aceite de oliva extra virgen", "Olave", "Botella 1 L", "1", "L", 9990],
    [3, 9, "ARR-0001", "Arroz grado 1 grano largo", "Tucapel", "Saco 5 kg", "5", "kg", 7490],
    [4, 9, "LEG-0001", "Lentejas 6 mm", null, "Bolsa 1 kg", "1", "kg", 2690],
    [5, 14, "HAR-0001", "Harina sin polvos de hornear", "Selecta", "Saco 25 kg", "25", "kg", 21990],
    [6, 15, "AZU-0001", "Azúcar granulada", "Iansa", "Saco 25 kg", "25", "kg", 27990],
    [7, 10, "QUE-0001", "Queso gauda laminado", "Colún", "Paquete 1 kg", "1", "kg", 10990],
    [8, 10, "QUE-0002", "Queso mozzarella en barra", "Soprole", "Barra 1 kg", "1", "kg", 8990],
    [9, 11, "LEC-0001", "Leche entera", "Colún", "Caja 1 L", "1", "L", 1190],
    [10, 11, "CRE-0001", "Crema para batir 35% MG", "Soprole", "Caja 1 L", "1", "L", 5490],
    [11, 2, "HUE-0001", "Huevos blancos extra", null, "Bandeja 30 un", "30", "unidad", 6990],
    [12, 12, "VAC-0001", "Posta negra de vacuno", null, "Envasado al vacío 1 kg", "1", "kg", 11990],
    [13, 13, "POL-0001", "Pechuga de pollo deshuesada IQF", null, "Bolsa 1 kg", "1", "kg", 6490],
    [14, 4, "FRU-0001", "Palta Hass calibre 18", null, "Granel 1 kg", "1", "kg", 4990],
    [15, 4, "VER-0001", "Tomate larga vida", null, "Granel 1 kg", "1", "kg", 1490],
    [16, 5, "BEB-0001", "Bebida cola", "Coca-Cola", "Botella desechable 3 L", "3", "L", 3290],
    [17, 7, "ASE-0001", "Guantes de nitrilo talla M", null, "Caja 100 un", "100", "unidad", 7990]
  ] as const
).map(([id, categoriaId, sku, nombre, marca, formato, contenido, unidad, precioReferencia]) => ({
  id,
  categoriaId,
  sku,
  nombre,
  marca,
  formato,
  contenido,
  unidad: unidad as Unidad,
  precioReferencia,
  topeSobreReferenciaPct: 30,
  estado: "publicado" as const
}));
