import { revisarDocumentoSchema, type ProveedorRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { exigirProveedor } from "./proveedor-reglas.js";

// Aprueba o rechaza (con motivo) un documento. Audita en la misma transaccion.
export function revisarDocumentoProveedor(deps: { proveedorRepository: ProveedorRepository; ahora?: () => Date }) {
  return async (proveedorId: number, documentoId: number, input: unknown, usuarioId: number) => {
    const dto = validar(revisarDocumentoSchema, input);
    await exigirProveedor(deps.proveedorRepository, proveedorId);
    const doc = await deps.proveedorRepository.buscarDocumento(documentoId);
    if (!doc || doc.proveedorId !== proveedorId) {
      throw new ErrorAplicacion(404, "DOCUMENTO_NO_ENCONTRADO", "Documento no encontrado para este proveedor");
    }
    const rechazo = dto.decision === "rechazado";
    const motivo = rechazo ? (dto.motivo as string) : null;
    // auditoria_log.accion: aprobar -> "aprobar"; rechazar -> "editar" (el enum no tiene "rechazar").
    return deps.proveedorRepository.revisarDocumento(
      documentoId,
      { revisionEstado: dto.decision, motivoRechazo: motivo, revisadoPor: usuarioId, revisadoEn: (deps.ahora ?? (() => new Date()))() },
      {
        usuarioId,
        entidad: "proveedor_documento",
        entidadId: documentoId,
        accion: rechazo ? "editar" : "aprobar",
        datosAntes: { revisionEstado: doc.revisionEstado, motivoRechazo: doc.motivoRechazo },
        datosDespues: {
          operacion: rechazo ? "rechazar_documento" : "aprobar_documento",
          proveedorId,
          tipo: doc.tipo,
          revisionEstado: dto.decision,
          motivo
        }
      }
    );
  };
}
