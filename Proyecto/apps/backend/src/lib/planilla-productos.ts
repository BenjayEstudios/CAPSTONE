import ExcelJS from "exceljs";
import {
  COLUMNAS_IMPORTACION,
  ErrorAplicacion,
  MAX_FILAS_IMPORTACION,
  claveDeEncabezado,
  etiquetasCategorias,
  type Celda,
  type ClaveColumna,
  type FilaImportacion
} from "@cotizapp/application";
import type { Categoria, Producto } from "@cotizapp/domain";

// Lectura/escritura de la planilla Excel de carga masiva del catalogo. Aqui vive
// todo lo que sabe de .xlsx; el caso de uso solo ve filas ya traducidas.

export const HOJA_PRODUCTOS = "Productos";
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FILAS_CON_LISTA_MIN = 1000;

// Con `productos`, la hoja Productos viene cargada con el catalogo actual (una fila por SKU) para
// editarlo y volver a subirlo: sin tocar nada, la carga resulta "sin cambios" en todas las filas.
export async function generarPlantilla(categorias: Categoria[], productos: Producto[] = []): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cotizapp";

  const hoja = wb.addWorksheet(HOJA_PRODUCTOS, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = COLUMNAS_IMPORTACION.map((c) => ({
    header: c.encabezado + (c.obligatoria ? " *" : ""),
    key: c.clave,
    width: Math.max(14, c.encabezado.length + 6),
    // SKU y EAN como texto: Excel no debe perder ceros a la izquierda ni pasar el EAN a notacion cientifica.
    style: c.clave === "sku" || c.clave === "ean" ? { numFmt: "@" } : {}
  }));
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };

  const etiquetaDe = new Map(etiquetasCategorias(categorias).map((c) => [c.id, c.etiqueta]));
  for (const p of productos) {
    hoja.addRow({
      sku: p.sku,
      nombre: p.nombre,
      categoria: etiquetaDe.get(p.categoriaId) ?? p.categoriaId,
      unidad: p.unidad,
      marca: p.marca ?? undefined,
      formato: p.formato ?? undefined,
      contenido: p.contenido ?? undefined,
      ean: p.ean ?? undefined,
      descripcion: p.descripcion ?? undefined,
      precioReferencia: p.precioReferencia ?? undefined,
      topeSobreReferenciaPct: p.topeSobreReferenciaPct ?? undefined,
      estado: p.estado
    });
  }
  const filasConLista = Math.max(FILAS_CON_LISTA_MIN, productos.length + 200);

  const col = (clave: ClaveColumna) => COLUMNAS_IMPORTACION.findIndex((c) => c.clave === clave) + 1;
  const listas: Array<[ClaveColumna, string]> = [
    ["unidad", '"kg,L,unidad"'],
    ["estado", '"borrador,publicado,archivado"']
  ];
  for (const [clave, formula] of listas) {
    for (let r = 2; r <= filasConLista + 1; r++) {
      hoja.getCell(r, col(clave)).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    }
  }

  const ayuda = wb.addWorksheet("Instrucciones");
  ayuda.columns = [
    { header: "Columna", width: 28 },
    { header: "Obligatoria", width: 22 },
    { header: "Ejemplo", width: 22 },
    { header: "Detalle", width: 90 }
  ];
  ayuda.getRow(1).font = { bold: true };
  for (const c of COLUMNAS_IMPORTACION) {
    ayuda.addRow([c.encabezado, c.clave === "sku" ? "Siempre" : c.obligatoria ? "Solo producto nuevo" : "No", c.ejemplo, c.ayuda]);
  }
  ayuda.addRow([]);
  for (const linea of [
    "El SKU es la llave: si ya existe en el catalogo, se ACTUALIZA ese producto; si no, se CREA.",
    "En una actualizacion, las celdas vacias NO se modifican (no sirven para borrar un dato).",
    "Para editar lo que ya existe, descarga el catalogo actual desde la pantalla de importacion, modifica las celdas y vuelve a subirlo.",
    "Las imagenes no van en la planilla: se suben desde la ficha del producto.",
    `Maximo ${MAX_FILAS_IMPORTACION} filas por carga. Los encabezados se reconocen aunque cambien tildes o mayusculas.`,
    "Antes de guardar, la pantalla muestra una simulacion con lo que se creara, actualizara o rechazara."
  ]) {
    ayuda.addRow([linea]);
  }

  const cats = wb.addWorksheet("Categorias");
  cats.columns = [
    { header: "ID", width: 8 },
    { header: "Categoria (usar este texto o el ID)", width: 50 },
    { header: "Estado", width: 12 }
  ];
  cats.getRow(1).font = { bold: true };
  for (const c of etiquetasCategorias(categorias)) cats.addRow([c.id, c.etiqueta, c.estado]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Valor de celda -> escalar simple (maneja texto enriquecido, formulas e hipervinculos).
function aEscalar(v: ExcelJS.CellValue): Celda {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return aEscalar(v.result as ExcelJS.CellValue);
  if ("text" in v) return typeof v.text === "string" ? v.text : aEscalar(v.text as ExcelJS.CellValue);
  return undefined; // error de celda (#N/A, ...)
}

export async function leerPlanilla(contenido: Buffer): Promise<FilaImportacion[]> {
  const wb = new ExcelJS.Workbook();
  try {
    // Un .xlsx es un zip: la firma "PK" descarta de inmediato renombrados (.csv, .xls, imagenes).
    if (contenido.length < 4 || contenido[0] !== 0x50 || contenido[1] !== 0x4b) throw new Error("no es xlsx");
    await wb.xlsx.load(contenido as unknown as ExcelJS.Buffer);
  } catch {
    throw new ErrorAplicacion(400, "ARCHIVO_INVALIDO", "El archivo no es una planilla Excel (.xlsx) valida");
  }

  const hoja = wb.getWorksheet(HOJA_PRODUCTOS) ?? wb.worksheets[0];
  if (!hoja) throw new ErrorAplicacion(400, "ARCHIVO_INVALIDO", "La planilla no tiene hojas");

  const columnas = new Map<number, ClaveColumna>();
  hoja.getRow(1).eachCell((celda, n) => {
    const e = aEscalar(celda.value);
    const clave = typeof e === "string" ? claveDeEncabezado(e.replace(/\*/g, "")) : null;
    if (clave && ![...columnas.values()].includes(clave)) columnas.set(n, clave);
  });
  if (![...columnas.values()].includes("sku")) {
    throw new ErrorAplicacion(
      400,
      "PLANTILLA_INVALIDA",
      `No se encontro la columna SKU en la primera fila de la hoja "${hoja.name}". Descarga la plantilla y usa sus encabezados`
    );
  }

  const filas: FilaImportacion[] = [];
  hoja.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;
    const valores: FilaImportacion["valores"] = {};
    let conDatos = false;
    for (const [n, clave] of columnas) {
      const v = aEscalar(row.getCell(n).value);
      if (v !== undefined && !(typeof v === "string" && v.trim() === "")) {
        valores[clave] = v;
        conDatos = true;
      }
    }
    if (conDatos) filas.push({ fila: numero, valores });
  });
  return filas;
}
