import { describe, expect, it } from "vitest";
import type { ProveedorDocumentoVigencia, RegistroAuditoria, VigenciaDocumento } from "@cotizapp/domain";
import { actualizarVigenciaDocumentos } from "./vigencia-documentos.use-case.js";

const AHORA = () => new Date("2026-11-21T15:00:00Z"); // 12:00 en Chile

function setup(docs: VigenciaDocumento[], falla: number[] = []) {
  const st = { docs: docs.map((d) => ({ ...d })), auditoria: [] as RegistroAuditoria[] };
  const proveedorRepository = {
    async listarVigenciaDocumentos() {
      return st.docs.map((d) => ({ ...d }));
    },
    async actualizarVigenciaDocumento(id: number, vigencia: ProveedorDocumentoVigencia, a: RegistroAuditoria) {
      if (falla.includes(id)) throw new Error("db caida");
      st.docs.find((d) => d.id === id)!.vigencia = vigencia;
      st.auditoria.push(a);
    }
  };
  return { st, job: actualizarVigenciaDocumentos({ proveedorRepository, ahora: AHORA }) };
}

const doc = (id: number, venceEn: string | null, vigencia: ProveedorDocumentoVigencia): VigenciaDocumento => ({ id, proveedorId: 1, tipo: "resolucion_sanitaria", venceEn, vigencia });

describe("actualizarVigenciaDocumentos (KAN-150)", () => {
  it("marca por_vencer (<= 45 dias), vencido (fecha pasada) y devuelve a al_dia", async () => {
    const { st, job } = setup([
      doc(1, "2026-12-15", "al_dia"), // 24 dias -> por_vencer
      doc(2, "2026-11-20", "por_vencer"), // ayer -> vencido
      doc(3, "2027-06-01", "vencido"), // renovado -> al_dia
      doc(4, "2026-11-21", "al_dia"), // vence hoy -> por_vencer (aun vigente)
      doc(5, null, "al_dia") // sin vencimiento -> sin cambios
    ]);
    const r = await job();
    expect(r).toMatchObject({ fecha: "2026-11-21", revisados: 5, actualizados: 4, aPorVencer: 2, aVencido: 1, aAlDia: 1, errores: [] });
    expect(st.docs.map((d) => d.vigencia)).toEqual(["por_vencer", "vencido", "al_dia", "por_vencer", "al_dia"]);
    expect(st.auditoria[0]).toMatchObject({ usuarioId: null, entidad: "proveedor_documento", entidadId: 1, accion: "editar", datosAntes: { vigencia: "al_dia" } });
    expect(st.auditoria[0]?.datosDespues).toMatchObject({ operacion: "actualizar_vigencia", vigencia: "por_vencer", diasParaVencer: 24 });
  });

  it("es idempotente: una segunda corrida no cambia nada", async () => {
    const { st, job } = setup([doc(1, "2026-12-15", "al_dia"), doc(2, "2026-11-20", "al_dia")]);
    await job();
    const n = st.auditoria.length;
    expect(await job()).toMatchObject({ actualizados: 0 });
    expect(st.auditoria).toHaveLength(n);
  });

  it("un documento que falla no frena a los demas", async () => {
    const { st, job } = setup([doc(1, "2026-11-01", "al_dia"), doc(2, "2026-11-02", "al_dia")], [1]);
    const r = await job();
    expect(r).toMatchObject({ actualizados: 1, aVencido: 1 });
    expect(r.errores).toEqual([{ documentoId: 1, mensaje: "db caida" }]);
    expect(st.docs[1]?.vigencia).toBe("vencido");
  });
});
