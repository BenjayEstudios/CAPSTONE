import { describe, expect, it } from "vitest";
import type {
  Proveedor,
  ProveedorDocumento,
  ProveedorDocumentoTipo,
  ProveedorRepository,
  RegistroAuditoria
} from "@cotizapp/domain";
import { aprobarProveedor, rechazarProveedor, suspenderProveedor } from "./cambiar-estado-proveedor.use-case.js";
import { obtenerProveedor } from "./obtener-proveedor.use-case.js";
import { revisarDocumentoProveedor } from "./revisar-documento-proveedor.use-case.js";

const prov = (id: number, estado: Proveedor["estado"] = "en_revision"): Proveedor => ({
  id, tipo: "proveedor", razonSocial: `P${id}`, rut: `${id}-1`, nombreFantasia: null, giro: null, emailContacto: null,
  telefono: null, direccionId: null, estado, comisionPct: null, plazoEstandarHoras: null, plazoFueraRegionHoras: null,
  horaCorte: null, despachoGratisDesde: null, ofreceDespacho: null, ofreceRetiro: null, entregasATiempoPct: null,
  banco: null, cuentaBancaria: null, creadaEn: new Date()
});
const doc = (
  id: number,
  proveedorId: number,
  tipo: ProveedorDocumentoTipo,
  revisionEstado: ProveedorDocumento["revisionEstado"] = "pendiente"
): ProveedorDocumento => ({
  id, proveedorId, tipo, url: "u", venceEn: null, vigencia: "al_dia", revisionEstado, motivoRechazo: null, revisadoPor: null, revisadoEn: null
});

function repoEnMemoria(provs: Proveedor[], docs: ProveedorDocumento[]) {
  const auditoria: RegistroAuditoria[] = [];
  const repo: ProveedorRepository & { auditoria: RegistroAuditoria[]; docs: ProveedorDocumento[] } = {
    auditoria,
    docs,
    listar: async () => ({ items: [], total: 0 }),
    buscarPorId: async (id) => provs.find((p) => p.id === id) ?? null,
    listarDocumentos: async (pid) => docs.filter((d) => d.proveedorId === pid),
    buscarDocumento: async (id) => docs.find((d) => d.id === id) ?? null,
    revisarDocumento: async (id, r, a) => {
      const d = docs.find((x) => x.id === id)!;
      Object.assign(d, { revisionEstado: r.revisionEstado, motivoRechazo: r.motivoRechazo, revisadoEn: r.revisadoEn });
      auditoria.push(a);
      return d;
    },
    cambiarEstado: async (id, estado, comision, a) => {
      const p = provs.find((x) => x.id === id)!;
      p.estado = estado;
      if (comision !== undefined) p.comisionPct = comision;
      auditoria.push(a);
      return p;
    }
  };
  return repo;
}
const tres = (pid: number, rev: ProveedorDocumento["revisionEstado"] = "aprobado") => [
  doc(pid * 10 + 1, pid, "carpeta_tributaria", rev),
  doc(pid * 10 + 2, pid, "resolucion_sanitaria", rev),
  doc(pid * 10 + 3, pid, "vigencia", rev)
];

describe("aprobarProveedor", () => {
  it("409 REQUISITOS_INCOMPLETOS con la lista de faltantes", async () => {
    const r = repoEnMemoria([prov(1)], [doc(11, 1, "carpeta_tributaria", "aprobado"), doc(12, 1, "vigencia", "pendiente")]);
    const uc = aprobarProveedor({ proveedorRepository: r });
    await expect(uc(1, {}, 9)).rejects.toMatchObject({ statusCode: 409, code: "REQUISITOS_INCOMPLETOS" });
    await expect(uc(1, {}, 9)).rejects.toThrow(/resolucion_sanitaria, vigencia/);
  });
  it("el documento mas reciente de cada tipo es el que cuenta", async () => {
    const r = repoEnMemoria([prov(1)], [...tres(1), doc(99, 1, "vigencia", "rechazado")]);
    await expect(aprobarProveedor({ proveedorRepository: r })(1, {}, 9)).rejects.toMatchObject({ code: "REQUISITOS_INCOMPLETOS" });
  });
  it("activa, guarda comision opcional y audita", async () => {
    const r = repoEnMemoria([prov(1)], tres(1));
    const res = await aprobarProveedor({ proveedorRepository: r })(1, { comisionPct: 8.5 }, 9);
    expect(res).toMatchObject({ estado: "activa", comisionPct: 8.5 });
    expect(r.auditoria[0]).toMatchObject({ usuarioId: 9, entidad: "organizacion", accion: "aprobar", datosAntes: { estado: "en_revision" } });
  });
  it("comision fuera de rango -> 400; suspendida -> activa permitido", async () => {
    const r = repoEnMemoria([prov(1, "suspendida")], tres(1));
    const uc = aprobarProveedor({ proveedorRepository: r });
    await expect(uc(1, { comisionPct: 101 }, 9)).rejects.toMatchObject({ statusCode: 400 });
    expect((await uc(1, undefined, 9)).estado).toBe("activa");
  });
  it("activa -> aprobar es TRANSICION_INVALIDA; no-proveedor -> 404", async () => {
    const r = repoEnMemoria([prov(1, "activa")], tres(1));
    const uc = aprobarProveedor({ proveedorRepository: r });
    await expect(uc(1, {}, 9)).rejects.toMatchObject({ statusCode: 409, code: "TRANSICION_INVALIDA" });
    await expect(uc(2, {}, 9)).rejects.toMatchObject({ statusCode: 404, code: "PROVEEDOR_NO_ENCONTRADO" });
  });
});

describe("rechazar / suspender", () => {
  it("exigen motivo", async () => {
    const r = repoEnMemoria([prov(1)], []);
    await expect(rechazarProveedor({ proveedorRepository: r })(1, {}, 9)).rejects.toMatchObject({ code: "VALIDACION" });
    await expect(suspenderProveedor({ proveedorRepository: r })(1, { motivo: " " }, 9)).rejects.toMatchObject({ code: "VALIDACION" });
  });
  it("rechazar solo desde en_revision, deja suspendida y audita con motivo", async () => {
    const r = repoEnMemoria([prov(1), prov(2, "activa")], []);
    const uc = rechazarProveedor({ proveedorRepository: r });
    expect((await uc(1, { motivo: "Docs ilegibles" }, 9)).estado).toBe("suspendida");
    expect(r.auditoria[0].datosDespues).toMatchObject({ operacion: "rechazar_proveedor", motivo: "Docs ilegibles" });
    await expect(uc(2, { motivo: "x" }, 9)).rejects.toMatchObject({ code: "TRANSICION_INVALIDA" });
  });
  it("suspender: activa -> suspendida con accion suspender; suspendida no se puede suspender", async () => {
    const r = repoEnMemoria([prov(1, "activa"), prov(2, "suspendida")], []);
    const uc = suspenderProveedor({ proveedorRepository: r });
    await uc(1, { motivo: "Reclamos" }, 9);
    expect(r.auditoria[0]).toMatchObject({ accion: "suspender" });
    await expect(uc(2, { motivo: "x" }, 9)).rejects.toMatchObject({ code: "TRANSICION_INVALIDA" });
  });
});

describe("revisarDocumentoProveedor", () => {
  it("rechazar exige motivo (1-240)", async () => {
    const r = repoEnMemoria([prov(1)], tres(1, "pendiente"));
    const uc = revisarDocumentoProveedor({ proveedorRepository: r });
    await expect(uc(1, 11, { decision: "rechazado" }, 9)).rejects.toMatchObject({ code: "VALIDACION" });
    await expect(uc(1, 11, { decision: "rechazado", motivo: "x".repeat(241) }, 9)).rejects.toMatchObject({ code: "VALIDACION" });
  });
  it("rechaza con motivo y aprueba, ambos auditados", async () => {
    const r = repoEnMemoria([prov(1)], tres(1, "pendiente"));
    const uc = revisarDocumentoProveedor({ proveedorRepository: r });
    await uc(1, 11, { decision: "rechazado", motivo: "Borroso" }, 9);
    expect(r.docs[0]).toMatchObject({ revisionEstado: "rechazado", motivoRechazo: "Borroso" });
    await uc(1, 11, { decision: "aprobado", motivo: "ignorado" }, 9);
    expect(r.docs[0]).toMatchObject({ revisionEstado: "aprobado", motivoRechazo: null });
    expect(r.auditoria.map((a) => a.accion)).toEqual(["editar", "aprobar"]);
  });
  it("documento de otro proveedor -> 404", async () => {
    const r = repoEnMemoria([prov(1), prov(2)], [...tres(1), ...tres(2)]);
    await expect(revisarDocumentoProveedor({ proveedorRepository: r })(1, 21, { decision: "aprobado" }, 9)).rejects.toMatchObject({
      statusCode: 404,
      code: "DOCUMENTO_NO_ENCONTRADO"
    });
  });
});

describe("obtenerProveedor", () => {
  it("resume requisitos", async () => {
    const r = repoEnMemoria([prov(1)], [doc(11, 1, "carpeta_tributaria", "aprobado")]);
    const res = await obtenerProveedor({ proveedorRepository: r })(1);
    expect(res.requisitos).toEqual({ documentosFaltantes: ["resolucion_sanitaria", "vigencia"], puedeAprobar: false });
  });
});
