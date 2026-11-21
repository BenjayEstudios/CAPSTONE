import type { ProveedorDocumentoVigencia, ProveedorRepository } from "@cotizapp/domain";
import { fechaChile } from "./liquidaciones.use-cases.js";
import { vigenciaDocumento } from "./panel-proveedor.use-cases.js";

// KAN-150. Job que recalcula la vigencia de los documentos de los proveedores
// (resolucion sanitaria, certificado de vigencia, ...): al_dia -> por_vencer
// (faltan <= DIAS_POR_VENCER dias) -> vencido (la fecha ya paso). Es
// idempotente: solo toca los documentos cuya vigencia guardada difiere de la
// calculada hoy, y cada cambio deja una fila en auditoria_log (accion del
// sistema, usuario null). Un documento que falla no frena a los demas.

interface Deps {
  proveedorRepository: Pick<ProveedorRepository, "listarVigenciaDocumentos" | "actualizarVigenciaDocumento">;
  ahora?: () => Date;
  log?: (mensaje: string, error?: unknown) => void;
}

export interface ResultadoVigencia {
  fecha: string;
  revisados: number;
  actualizados: number;
  /** Documentos que pasaron a cada vigencia en esta corrida. */
  aPorVencer: number;
  aVencido: number;
  aAlDia: number;
  errores: Array<{ documentoId: number; mensaje: string }>;
}

export function actualizarVigenciaDocumentos(deps: Deps) {
  return async (): Promise<ResultadoVigencia> => {
    // La fecha de vencimiento es una fecha calendario chilena.
    const hoy = fechaChile(deps.ahora?.() ?? new Date());
    const documentos = await deps.proveedorRepository.listarVigenciaDocumentos();
    const r: ResultadoVigencia = { fecha: hoy, revisados: documentos.length, actualizados: 0, aPorVencer: 0, aVencido: 0, aAlDia: 0, errores: [] };

    for (const d of documentos) {
      const { estado, diasParaVencer } = vigenciaDocumento(d.venceEn, hoy);
      if (estado === d.vigencia) continue;
      try {
        await deps.proveedorRepository.actualizarVigenciaDocumento(d.id, estado satisfies ProveedorDocumentoVigencia, {
          usuarioId: null,
          entidad: "proveedor_documento",
          entidadId: d.id,
          accion: "editar",
          datosAntes: { vigencia: d.vigencia },
          datosDespues: { operacion: "actualizar_vigencia", vigencia: estado, venceEn: d.venceEn, diasParaVencer, proveedorId: d.proveedorId, tipo: d.tipo }
        });
        r.actualizados++;
        if (estado === "por_vencer") r.aPorVencer++;
        else if (estado === "vencido") r.aVencido++;
        else r.aAlDia++;
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        r.errores.push({ documentoId: d.id, mensaje });
        deps.log?.(`No se pudo actualizar la vigencia del documento ${d.id}`, err);
      }
    }
    return r;
  };
}
