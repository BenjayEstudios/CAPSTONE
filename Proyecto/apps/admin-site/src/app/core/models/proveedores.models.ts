export type EstadoProveedor = "en_revision" | "activa" | "suspendida";
export type TipoDocumento = "carpeta_tributaria" | "resolucion_sanitaria" | "vigencia";
export type VigenciaDocumento = "al_dia" | "por_vencer" | "vencido";
export type RevisionEstado = "pendiente" | "aprobado" | "rechazado";

export interface ResumenDocumentos {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

export interface ProveedorListadoItem {
  id: string;
  razonSocial: string;
  nombreFantasia: string | null;
  rut: string;
  estado: EstadoProveedor;
  comisionPct: number | null;
  creadaEn: string;
  documentos: ResumenDocumentos;
}

export interface ProveedorListadoRespuesta {
  items: ProveedorListadoItem[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosProveedores {
  estado?: EstadoProveedor | "";
  q?: string;
  pagina?: number;
  tamano?: number;
}

export interface DocumentoProveedor {
  id: string;
  proveedorId: string;
  tipo: TipoDocumento;
  url: string;
  venceEn: string | null;
  vigencia: VigenciaDocumento;
  revisionEstado: RevisionEstado;
  motivoRechazo: string | null;
  revisadoPor: { id: string; nombre: string } | null;
  revisadoEn: string | null;
}

export interface ProveedorFicha {
  id: string;
  razonSocial: string;
  nombreFantasia: string | null;
  rut: string;
  giro: string | null;
  emailContacto: string | null;
  telefono: string | null;
  estado: EstadoProveedor;
  comisionPct: number | null;
  banco: string | null;
  cuentaBancaria: string | null;
  creadaEn: string;
  documentos: DocumentoProveedor[];
  requisitos: { documentosFaltantes: TipoDocumento[]; puedeAprobar: boolean };
}

export interface ResultadoEstado {
  id: string;
  estado: EstadoProveedor;
  comisionPct: number | null;
}
