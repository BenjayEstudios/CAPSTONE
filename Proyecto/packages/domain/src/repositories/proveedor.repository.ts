import type { Proveedor, ProveedorEstado, ProveedorListado } from "../entities/proveedor.entity.js";
import type { ProveedorDocumento, ProveedorDocumentoRevision } from "../entities/proveedor-documento.entity.js";

export interface FiltrosProveedores {
  estado?: ProveedorEstado;
  q?: string;
  pagina: number;
  tamano: number;
}

// Fila de auditoria_log (solo insercion). La escribe el repositorio en la
// MISMA transaccion que el cambio.
export interface RegistroAuditoria {
  usuarioId: number | null;
  entidad: string;
  entidadId: number;
  accion: "crear" | "editar" | "eliminar" | "aprobar" | "suspender" | "reembolsar";
  datosAntes: unknown;
  datosDespues: unknown;
}

export interface RevisionDocumento {
  revisionEstado: ProveedorDocumentoRevision;
  motivoRechazo: string | null;
  revisadoPor: number;
  revisadoEn: Date;
}

// Puerto de persistencia de proveedores (organizacion tipo = proveedor) y sus documentos.
export interface ProveedorRepository {
  listar(f: FiltrosProveedores): Promise<{ items: ProveedorListado[]; total: number }>;
  /** null si no existe o no es tipo proveedor. */
  buscarPorId(id: number): Promise<Proveedor | null>;
  listarDocumentos(proveedorId: number): Promise<ProveedorDocumento[]>;
  buscarDocumento(documentoId: number): Promise<ProveedorDocumento | null>;
  revisarDocumento(documentoId: number, revision: RevisionDocumento, auditoria: RegistroAuditoria): Promise<ProveedorDocumento>;
  cambiarEstado(
    id: number,
    estado: ProveedorEstado,
    comisionPct: number | undefined,
    auditoria: RegistroAuditoria
  ): Promise<Proveedor>;
}
