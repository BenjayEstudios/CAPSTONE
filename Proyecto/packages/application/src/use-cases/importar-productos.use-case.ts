import type { Categoria, CategoriaRepository, ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validarCambiosProducto } from "./actualizar-producto.use-case.js";
import { validarNuevoProducto } from "./crear-producto.use-case.js";
import { auditoriaCrearProducto, auditoriaEditarProducto } from "./producto-auditoria.js";

// Carga masiva del catalogo maestro desde una planilla (KAN: catalogo maestro).
// El SKU es la llave: si ya existe se ACTUALIZA el producto, si no se CREA.
// Cada fila pasa por las mismas reglas que crearProducto / actualizarProducto.

export const MAX_FILAS_IMPORTACION = 5000;

export type ClaveColumna =
  | "sku" | "nombre" | "categoria" | "unidad" | "marca" | "formato" | "contenido"
  | "ean" | "descripcion" | "precioReferencia" | "topeSobreReferenciaPct" | "estado";

export interface ColumnaImportacion {
  clave: ClaveColumna;
  encabezado: string;
  /** Obligatoria solo cuando el SKU no existe (producto nuevo). El SKU lo es siempre. */
  obligatoria: boolean;
  ejemplo: string | number;
  ayuda: string;
}

// Orden y textos de la plantilla Excel (la hoja se genera desde esta lista).
export const COLUMNAS_IMPORTACION: ColumnaImportacion[] = [
  { clave: "sku", encabezado: "SKU", obligatoria: true, ejemplo: "ARR-001", ayuda: "Llave del producto. Letras, numeros, punto, guion y guion bajo (max. 24). Si ya existe, se actualiza." },
  { clave: "nombre", encabezado: "Nombre", obligatoria: true, ejemplo: "Arroz grado 1", ayuda: "Max. 180 caracteres." },
  { clave: "categoria", encabezado: "Categoria", obligatoria: true, ejemplo: "Alimentos > Secos", ayuda: "Como aparece en la hoja Categorias (\"Padre > Hija\"), o su ID." },
  { clave: "unidad", encabezado: "Unidad", obligatoria: true, ejemplo: "kg", ayuda: "kg, L o unidad." },
  { clave: "marca", encabezado: "Marca", obligatoria: false, ejemplo: "Tucapel", ayuda: "Max. 80 caracteres." },
  { clave: "formato", encabezado: "Formato", obligatoria: false, ejemplo: "Saco 25 kg", ayuda: "Max. 80 caracteres." },
  { clave: "contenido", encabezado: "Contenido", obligatoria: false, ejemplo: 25, ayuda: "Cantidad por envase, en la unidad indicada (hasta 3 decimales)." },
  { clave: "ean", encabezado: "EAN", obligatoria: false, ejemplo: "7801234567890", ayuda: "8 a 14 digitos. No se puede repetir." },
  { clave: "descripcion", encabezado: "Descripcion", obligatoria: false, ejemplo: "Arroz de grano largo", ayuda: "Max. 5000 caracteres." },
  { clave: "precioReferencia", encabezado: "Precio referencia", obligatoria: false, ejemplo: 28000, ayuda: "CLP, entero positivo." },
  { clave: "topeSobreReferenciaPct", encabezado: "Tope sobre referencia (%)", obligatoria: false, ejemplo: 10, ayuda: "Entero de 0 a 100. Requiere precio de referencia." },
  { clave: "estado", encabezado: "Estado", obligatoria: false, ejemplo: "borrador", ayuda: "borrador, publicado o archivado. Publicar exige imagen principal (se sube desde la ficha)." }
];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

const CLAVE_POR_ENCABEZADO = new Map<string, ClaveColumna>([
  ...COLUMNAS_IMPORTACION.map((c) => [normalizar(c.encabezado), c.clave] as const),
  ...COLUMNAS_IMPORTACION.map((c) => [normalizar(c.clave), c.clave] as const),
  ["tope", "topeSobreReferenciaPct"],
  ["tope sobre referencia", "topeSobreReferenciaPct"],
  ["precio", "precioReferencia"]
]);

/** Traduce el texto de un encabezado de la planilla a su columna; null si no se reconoce. */
export function claveDeEncabezado(encabezado: string): ClaveColumna | null {
  return CLAVE_POR_ENCABEZADO.get(normalizar(encabezado)) ?? null;
}

export type Celda = string | number | boolean | Date | null | undefined;

export interface FilaImportacion {
  /** Numero de fila en la planilla (para informar errores). */
  fila: number;
  valores: Partial<Record<ClaveColumna, Celda>>;
}

export type AccionFila = "crear" | "actualizar" | "sin_cambios" | "error";

export interface ResultadoFilaImportacion {
  fila: number;
  sku: string | null;
  accion: AccionFila;
  productoId?: number;
  error?: { codigo: string; mensaje: string };
}

export interface ResultadoImportacion {
  /** true = solo se valido; no se escribio nada. */
  simulacion: boolean;
  totalFilas: number;
  resumen: { crear: number; actualizar: number; sinCambios: number; errores: number };
  filas: ResultadoFilaImportacion[];
}

const texto = (v: Celda): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

function numero(v: Celda, campo: string): number | undefined {
  const t = texto(v);
  if (t === undefined) return undefined;
  if (typeof v === "number") return v;
  // "$28.000" / "1,5" -> 28000 / 1.5 (punto como miles solo si agrupa de a 3 digitos).
  const limpio = t.replace(/[$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpio);
  if (!Number.isFinite(n)) throw new ErrorAplicacion(400, "VALIDACION", `${campo}: "${t}" no es un numero`);
  return n;
}

const UNIDADES: Record<string, string> = {
  kg: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  l: "L", lt: "L", lts: "L", litro: "L", litros: "L",
  unidad: "unidad", unidades: "unidad", un: "unidad", uni: "unidad", u: "unidad"
};

function etiquetaCategoria(c: Categoria, porId: Map<number, Categoria>) {
  const padre = c.padreId ? porId.get(c.padreId) : undefined;
  return padre ? `${padre.nombre} > ${c.nombre}` : c.nombre;
}

/** "Padre > Hija" por categoria, ordenadas: lo que la hoja Categorias de la plantilla le ofrece al usuario. */
export function etiquetasCategorias(cats: Categoria[]) {
  const porId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => ({ id: c.id, etiqueta: etiquetaCategoria(c, porId), estado: c.estado }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

const normalizarRuta =(s: string) => s.split(">").map(normalizar).join(" > ");

function resolvedorCategorias(cats: Categoria[]) {
  const porId = new Map(cats.map((c) => [c.id, c]));
  const porEtiqueta = new Map(cats.map((c) => [normalizarRuta(etiquetaCategoria(c, porId)), c.id]));
  const porNombre = new Map<string, number[]>();
  for (const c of cats) {
    const k = normalizar(c.nombre);
    porNombre.set(k, [...(porNombre.get(k) ?? []), c.id]);
  }
  return (valor: string): number => {
    if (/^\d+$/.test(valor)) {
      const id = Number(valor);
      if (porId.has(id)) return id;
      throw new ErrorAplicacion(400, "CATEGORIA_NO_EXISTE", `categoria: el ID ${id} no existe`);
    }
    const porRuta = porEtiqueta.get(normalizarRuta(valor));
    if (porRuta !== undefined) return porRuta;
    const mismoNombre = porNombre.get(normalizar(valor)) ?? [];
    if (mismoNombre.length === 1) return mismoNombre[0];
    if (mismoNombre.length > 1) {
      throw new ErrorAplicacion(400, "CATEGORIA_AMBIGUA", `categoria: "${valor}" existe mas de una vez; usa "Padre > Hija"`);
    }
    throw new ErrorAplicacion(400, "CATEGORIA_NO_EXISTE", `categoria: "${valor}" no existe (ver hoja Categorias)`);
  };
}

// Celdas -> campos del producto. Celda vacia = no informado (en una edicion, no se toca).
function camposDeFila(f: FilaImportacion, resolverCategoria: (v: string) => number) {
  const v = f.valores;
  const c: Record<string, unknown> = {};
  const set = (k: string, val: unknown) => {
    if (val !== undefined) c[k] = val;
  };
  set("nombre", texto(v.nombre));
  const cat = texto(v.categoria);
  if (cat !== undefined) set("categoriaId", resolverCategoria(cat));
  const unidad = texto(v.unidad);
  if (unidad !== undefined) set("unidad", UNIDADES[unidad.toLowerCase()] ?? unidad);
  set("marca", texto(v.marca));
  set("formato", texto(v.formato));
  set("contenido", numero(v.contenido, "contenido"));
  set("ean", texto(v.ean));
  set("descripcion", texto(v.descripcion));
  set("precioReferencia", numero(v.precioReferencia, "precio de referencia"));
  set("topeSobreReferenciaPct", numero(v.topeSobreReferenciaPct, "tope sobre referencia"));
  set("estado", texto(v.estado)?.toLowerCase());
  return c;
}

export function importarProductos(deps: {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}) {
  return async (filas: FilaImportacion[], usuarioId: number | null, opciones: { simular: boolean }) => {
    const repo = deps.productoRepository;
    if (filas.length === 0) {
      throw new ErrorAplicacion(400, "ARCHIVO_VACIO", "La planilla no tiene filas con datos");
    }
    if (filas.length > MAX_FILAS_IMPORTACION) {
      throw new ErrorAplicacion(
        400,
        "DEMASIADAS_FILAS",
        `La planilla tiene ${filas.length} filas; el maximo por carga es ${MAX_FILAS_IMPORTACION}`
      );
    }

    const resolverCategoria = resolvedorCategorias(await deps.categoriaRepository.listar());
    const skusVistos = new Map<string, number>();
    const eansVistos = new Map<string, number>();
    const resultados: ResultadoFilaImportacion[] = [];

    for (const f of filas) {
      const sku = texto(f.valores.sku)?.toUpperCase() ?? null;
      try {
        if (sku === null) throw new ErrorAplicacion(400, "VALIDACION", "sku: falta el SKU");
        const previa = skusVistos.get(sku);
        if (previa !== undefined) {
          throw new ErrorAplicacion(409, "SKU_REPETIDO_EN_ARCHIVO", `El SKU ${sku} ya aparece en la fila ${previa}`);
        }
        skusVistos.set(sku, f.fila);

        const campos = camposDeFila(f, resolverCategoria);
        const existente = await repo.buscarPorSku(sku);
        let resultado: ResultadoFilaImportacion;
        let ean: string | undefined;

        if (existente) {
          // Solo se envian los campos informados que realmente cambian.
          const cambiosCrudos: Record<string, unknown> = {};
          for (const [k, valor] of Object.entries(campos)) {
            if (valor !== (existente as unknown as Record<string, unknown>)[k]) cambiosCrudos[k] = valor;
          }
          if (Object.keys(cambiosCrudos).length === 0) {
            resultado = { fila: f.fila, sku, accion: "sin_cambios", productoId: existente.id };
          } else {
            const { actual, cambios } = await validarCambiosProducto(deps, existente.id, cambiosCrudos);
            ean = cambios.ean ?? undefined;
            comprobarEanEnArchivo(eansVistos, ean);
            if (!opciones.simular) {
              await repo.actualizar(
                existente.id,
                cambios,
                auditoriaEditarProducto(usuarioId, actual, cambios, "importar_producto")
              );
            }
            resultado = { fila: f.fila, sku, accion: "actualizar", productoId: existente.id };
          }
        } else {
          const faltan = (["nombre", "categoriaId", "unidad"] as const).filter((k) => campos[k] === undefined);
          if (faltan.length > 0) {
            const nombres = { nombre: "nombre", categoriaId: "categoria", unidad: "unidad" };
            throw new ErrorAplicacion(
              400,
              "VALIDACION",
              `SKU nuevo: falta ${faltan.map((k) => nombres[k]).join(", ")}`
            );
          }
          const data = await validarNuevoProducto(deps, { ...campos, sku });
          ean = data.ean ?? undefined;
          comprobarEanEnArchivo(eansVistos, ean);
          let productoId: number | undefined;
          if (!opciones.simular) {
            const creado = await repo.crear(
              { ...data, creadoPor: usuarioId },
              auditoriaCrearProducto(usuarioId, "importar_producto")
            );
            productoId = creado.id;
          }
          resultado = { fila: f.fila, sku, accion: "crear", ...(productoId !== undefined && { productoId }) };
        }
        if (ean) eansVistos.set(ean, f.fila);
        resultados.push(resultado);
      } catch (e) {
        // Los errores de negocio se informan por fila; cualquier otro (BD caida, bug) corta la carga.
        // Como el SKU es la llave, repetir la carga completa es seguro.
        if (!(e instanceof ErrorAplicacion)) throw e;
        resultados.push({ fila: f.fila, sku, accion: "error", error: { codigo: e.code, mensaje: e.message } });
      }
    }

    const cuenta = (a: AccionFila) => resultados.filter((r) => r.accion === a).length;
    return {
      simulacion: opciones.simular,
      totalFilas: filas.length,
      resumen: {
        crear: cuenta("crear"),
        actualizar: cuenta("actualizar"),
        sinCambios: cuenta("sin_cambios"),
        errores: cuenta("error")
      },
      filas: resultados
    } satisfies ResultadoImportacion;
  };
}

function comprobarEanEnArchivo(vistos: Map<string, number>, ean: string | undefined) {
  if (!ean) return;
  const previa = vistos.get(ean);
  if (previa !== undefined) {
    throw new ErrorAplicacion(409, "EAN_REPETIDO_EN_ARCHIVO", `El EAN ${ean} ya aparece en la fila ${previa}`);
  }
}
