import { describe, expect, it } from "vitest";
import type { AlmacenArchivos, ProveedorDocumento, ProveedorRepository, RegistroAuditoria } from "@cotizapp/domain";
import { detectarFormatoDocumento, misDocumentos, subirDocumento } from "./documentos-proveedor.use-cases.js";

const HOY = new Date("2026-11-20T15:00:00Z");
const doc = (id: number, tipo: ProveedorDocumento["tipo"], venceEn: string | null, revision: ProveedorDocumento["revisionEstado"] = "aprobado"): ProveedorDocumento => ({
  id, proveedorId: 2, tipo, url: `https://x/${id}.pdf`, venceEn, vigencia: "al_dia", revisionEstado: revision, motivoRechazo: revision === "rechazado" ? "Ilegible" : null, revisadoPor: null, revisadoEn: null
});
const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

function montar(docs: ProveedorDocumento[] = [], fallaRegistro = false) {
  const st = { creados: [] as unknown[], auditoria: [] as RegistroAuditoria[], guardados: [] as string[], eliminados: [] as string[] };
  const proveedorRepository = {
    listarDocumentos: async () => docs,
    crearDocumento: async (pid: number, d: { tipo: ProveedorDocumento["tipo"]; url: string; venceEn: string | null }, a: RegistroAuditoria) => {
      if (fallaRegistro) throw new Error("db caida");
      st.creados.push({ pid, ...d });
      st.auditoria.push(a);
      return { ...doc(99, d.tipo, d.venceEn, "pendiente"), url: d.url };
    }
  } as unknown as ProveedorRepository;
  const almacenArchivos: AlmacenArchivos = {
    guardar: async (_c, nombre) => (st.guardados.push(nombre), { url: `http://localhost/uploads/${nombre}`, clave: nombre }),
    eliminar: async (clave) => void st.eliminados.push(clave)
  };
  return { st, deps: { proveedorRepository, almacenArchivos, generarId: () => "abc", ahora: () => HOY } };
}

describe("documentos del proveedor (KAN-110)", () => {
  it("un documento por tipo exigido: el ultimo subido, con vigencia calculada hoy y su revision; sin documento, falta", async () => {
    const { deps } = montar([
      doc(1, "resolucion_sanitaria", "2026-11-15"),
      doc(3, "resolucion_sanitaria", "2026-12-20", "pendiente"),
      doc(2, "carpeta_tributaria", null, "rechazado")
    ]);
    const { items } = await misDocumentos(deps)(2);
    expect(items.map((d) => [d.tipo, d.estado, d.actual?.id ?? null, d.anteriores])).toEqual([
      ["carpeta_tributaria", "al_dia", 2, 0],
      ["resolucion_sanitaria", "por_vencer", 3, 1],
      ["vigencia", "falta", null, 0]
    ]);
    expect(items[1]!.actual).toMatchObject({ venceEn: "2026-12-20", diasParaVencer: 30, revisionEstado: "pendiente" });
    expect(items[0]!.actual).toMatchObject({ revisionEstado: "rechazado", motivoRechazo: "Ilegible" });
    expect(items.map((d) => d.requiereVencimiento)).toEqual([false, true, true]);
  });

  it("sube un PDF: nombre del servidor, revision pendiente, vigencia y auditoria", async () => {
    const { deps, st } = montar();
    const r = await subirDocumento(deps)(4, 2, { tipo: "vigencia", venceEn: "2027-01-10" }, PDF);
    expect(st.guardados).toEqual(["proveedores/2/documentos/vigencia-abc.pdf"]);
    expect(st.creados).toEqual([{ pid: 2, tipo: "vigencia", url: "http://localhost/uploads/proveedores/2/documentos/vigencia-abc.pdf", venceEn: "2027-01-10", vigencia: "al_dia" }]);
    expect(st.auditoria[0]).toMatchObject({ usuarioId: 4, entidad: "proveedor_documento", accion: "crear", datosDespues: { operacion: "subir_documento", tipo: "vigencia" } });
    expect(r).toMatchObject({ tipo: "vigencia", nombre: "Certificado de vigencia", revisionEstado: "pendiente", vigencia: "al_dia", diasParaVencer: 51 });
  });

  it("la carpeta tributaria no exige vencimiento; acepta PNG", async () => {
    const { deps, st } = montar();
    await subirDocumento(deps)(4, 2, { tipo: "carpeta_tributaria" }, PNG);
    expect(st.guardados).toEqual(["proveedores/2/documentos/carpeta_tributaria-abc.png"]);
  });

  it("rechaza: sin vencimiento cuando se exige, ya vencido, vacio, muy grande, otro formato, sin proveedor", async () => {
    const { deps, st } = montar();
    await expect(subirDocumento(deps)(4, 2, { tipo: "resolucion_sanitaria" }, PDF)).rejects.toMatchObject({ statusCode: 400, code: "VENCIMIENTO_REQUERIDO" });
    await expect(subirDocumento(deps)(4, 2, { tipo: "vigencia", venceEn: "2026-11-19" }, PDF)).rejects.toMatchObject({ code: "DOCUMENTO_VENCIDO" });
    await expect(subirDocumento(deps)(4, 2, { tipo: "vigencia", venceEn: "2026-11-20" }, PDF)).resolves.toBeDefined();
    await expect(subirDocumento(deps)(4, 2, { tipo: "carpeta_tributaria" }, new Uint8Array())).rejects.toMatchObject({ code: "ARCHIVO_VACIO" });
    await expect(subirDocumento({ ...deps, tamanoMaximoBytes: 4 })(4, 2, { tipo: "carpeta_tributaria" }, PDF)).rejects.toMatchObject({ statusCode: 413 });
    await expect(subirDocumento(deps)(4, 2, { tipo: "carpeta_tributaria" }, new TextEncoder().encode("hola"))).rejects.toMatchObject({ code: "FORMATO_NO_SOPORTADO" });
    await expect(subirDocumento(deps)(4, 2, { tipo: "patente" }, PDF)).rejects.toMatchObject({ statusCode: 400 });
    await expect(subirDocumento(deps)(4, Number.NaN, { tipo: "carpeta_tributaria" }, PDF)).rejects.toMatchObject({ statusCode: 403 });
    expect(st.guardados).toHaveLength(1); // solo el valido llego al almacen
  });

  it("si falla el registro, borra el archivo guardado", async () => {
    const { deps, st } = montar([], true);
    await expect(subirDocumento(deps)(4, 2, { tipo: "carpeta_tributaria" }, PDF)).rejects.toThrow("db caida");
    expect(st.eliminados).toEqual(["proveedores/2/documentos/carpeta_tributaria-abc.pdf"]);
  });

  it("formato por firma binaria", () => {
    expect(detectarFormatoDocumento(PDF)?.ext).toBe("pdf");
    expect(detectarFormatoDocumento(PNG)?.ext).toBe("png");
    expect(detectarFormatoDocumento(new Uint8Array([0xff, 0xd8, 0xff, 0]))?.ext).toBe("jpg");
    expect(detectarFormatoDocumento(new TextEncoder().encode("PDF-%"))).toBeNull();
  });
});
