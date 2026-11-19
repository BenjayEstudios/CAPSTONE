export type ProveedorDocumentoTipo = "carpeta_tributaria" | "resolucion_sanitaria" | "vigencia";
// Vigencia del documento (no su revision).
export type ProveedorDocumentoVigencia = "al_dia" | "por_vencer" | "vencido";
// Revision manual del admin.
export type ProveedorDocumentoRevision = "pendiente" | "aprobado" | "rechazado";

export const TIPOS_DOCUMENTO_REQUERIDOS: readonly ProveedorDocumentoTipo[] = [
  "carpeta_tributaria",
  "resolucion_sanitaria",
  "vigencia"
];

// Ver DataBase/dbDiagram.sql -> Table proveedor_documento.
export interface ProveedorDocumento {
  id: number;
  proveedorId: number;
  tipo: ProveedorDocumentoTipo;
  url: string;
  venceEn: string | null; // YYYY-MM-DD
  vigencia: ProveedorDocumentoVigencia;
  revisionEstado: ProveedorDocumentoRevision;
  motivoRechazo: string | null;
  revisadoPor: { id: number; nombre: string } | null;
  revisadoEn: Date | null;
}
