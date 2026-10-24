import type { DocumentoDetalle } from "@cotizapp/domain";

// Generador de PDF minimo (sin dependencias): texto en Helvetica (WinAnsi), paginas A4.
// Suficiente para representar documentos tributarios SIMULADOS; no es un PDF firmado ni valido ante el SII.

export const NOMBRE_DTE: Record<number, string> = {
  33: "FACTURA ELECTRONICA",
  39: "BOLETA ELECTRONICA",
  52: "GUIA DE DESPACHO ELECTRONICA",
  61: "NOTA DE CREDITO ELECTRONICA"
};
export const LEYENDA_SIMULADO = "DOCUMENTO SIMULADO - SIN VALIDEZ TRIBUTARIA";

const clp = (n: number) => "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cortar = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "." : s);
// Escapa para un string literal PDF; caracteres fuera de Latin-1 -> "?".
const esc = (s: string) =>
  Array.from(s)
    .map((c) => (c.charCodeAt(0) > 255 ? "?" : c))
    .join("")
    .replace(/[\()]/g, (m) => "\\" + m);

interface Op {
  x: number;
  y: number;
  t: string;
  size: number;
  bold?: boolean;
}

export function generarPdfDocumento(d: DocumentoDetalle): Uint8Array {
  const doc = d.documento;
  const paginas: Array<{ ops: Op[]; rects: string[] }> = [];
  let pag = { ops: [] as Op[], rects: [] as string[] };
  let y = 0;
  const nueva = () => {
    pag = { ops: [], rects: [] };
    paginas.push(pag);
    // Banner de advertencia en cada pagina.
    pag.rects.push("0.85 0.1 0.1 rg 40 790 515 28 re f");
    pag.ops.push({ x: 52, y: 800, t: LEYENDA_SIMULADO, size: 13, bold: true });
    y = 770;
  };
  const txt = (x: number, t: string, size = 10, bold = false) => pag.ops.push({ x, y, t, size, bold });
  const linea = (t: string, size = 10, bold = false, dy = 16) => {
    if (y < 70) nueva();
    txt(48, t, size, bold);
    y -= dy;
  };
  nueva();

  linea(`${NOMBRE_DTE[doc.tipoDte] ?? "DOCUMENTO"} N° ${doc.folio}`, 16, true, 24);
  linea(`Tipo DTE ${doc.tipoDte}  |  Orden ${d.ordenCodigo}  |  Emitido: ${doc.emitidoEn.toISOString().slice(0, 16).replace("T", " ")} UTC`);
  linea(`Estado SII (simulado): ${doc.estadoSii}${doc.trackIdSii ? "  |  Track ID: " + doc.trackIdSii : ""}`, 10, false, 22);
  linea("EMISOR", 10, true);
  linea(`${cortar(d.emisorNombre, 70)}  -  RUT ${doc.emisorRut}`, 10, false, 22);
  linea("RECEPTOR", 10, true);
  linea(`${cortar(d.receptorNombre, 70)}  -  RUT ${doc.receptorRut ?? "sin informar"}`, 10, false, 22);
  if (doc.tipoDte === 61) {
    linea("REFERENCIA", 10, true);
    linea(
      d.referencia
        ? `Corrige ${NOMBRE_DTE[d.referencia.tipoDte] ?? "documento"} N° ${d.referencia.folio} (tipo ${d.referencia.tipoDte})`
        : "Documento original no disponible"
    );
    linea(`Motivo: ${cortar(d.motivo ?? "-", 90)}`, 10, false, 22);
  }
  if (d.lineas.length && doc.tipoDte !== 61) {
    linea("DETALLE", 10, true);
    linea("Producto                                                    Cant.     P. unit.        Total", 9, true);
    for (const l of d.lineas) {
      const nombre = cortar(l.formato ? `${l.nombre} (${l.formato})` : l.nombre, 52);
      if (y < 70) nueva();
      txt(48, nombre, 9);
      txt(330, String(l.cantidad), 9);
      txt(400, clp(l.precioUnitario), 9);
      txt(490, clp(l.totalLinea), 9);
      y -= 14;
    }
    y -= 8;
  }
  if (y < 110) nueva();
  txt(380, "Neto", 10);
  txt(490, clp(doc.neto ?? 0), 10);
  y -= 15;
  txt(380, "IVA (19%)", 10);
  txt(490, clp(doc.iva ?? 0), 10);
  y -= 17;
  txt(380, "TOTAL", 12, true);
  txt(490, clp(doc.total), 12, true);
  y -= 30;
  linea("Documento generado por Cotizapp con fines de demostracion. La integracion real con el SII esta fuera del alcance del MVP.", 8);

  // Ensamblado: 1 catalogo, 2 paginas, 3 Helvetica, 4 Helvetica-Bold, luego (pagina, contenido) por pagina.
  const objs: string[] = [];
  const idPagina = (i: number) => 5 + i * 2;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(" ")}] /Count ${paginas.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  paginas.forEach((p, i) => {
    const partes = [...p.rects];
    for (const o of p.ops) {
      const color = o.y > 795 ? "1 1 1 rg" : "0 g";
      partes.push(`BT ${color} /${o.bold ? "F2" : "F1"} ${o.size} Tf ${o.x} ${o.y} Td (${esc(o.t)}) Tj ET`);
    }
    const contenido = partes.join("\n");
    objs[idPagina(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPagina(i) + 1} 0 R >>`;
    objs[idPagina(i) + 1] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
