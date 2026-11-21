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
/** Zona de despacho de un proveedor: una comuna, o toda la region si comunaId es null. */
export interface ZonaCobertura {
  comunaId: number | null;
  comuna: string | null;
  regionCodigo: string;
  region: string;
  costoDespacho: number;
  plazoHoras: number | null;
}

/** Condiciones de entrega del proveedor (valen para todas sus ofertas). */
export interface CondicionesEntregaProveedor {
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  plazoEstandarHoras: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  zonas: ZonaCobertura[];
}

/** Una direccion del perfil, con su comuna y region (KAN-108). */
export interface DireccionPerfil {
  calle: string;
  numero: string | null;
  complemento: string | null;
  comunaId: number;
  comuna: string;
  region: string;
}

/** Perfil de empresa del proveedor (KAN-108): ficha publica y documentos tributarios. */
export interface PerfilProveedor {
  id: number;
  razonSocial: string;
  rut: string;
  nombreFantasia: string | null;
  giro: string | null;
  emailContacto: string | null;
  telefono: string | null;
  direccion: DireccionPerfil | null;
  /** Punto de retiro principal (el activo mas antiguo); el resto se ve en KAN-109. */
  bodega: { id: number; nombre: string; horario: string | null; direccion: DireccionPerfil } | null;
  plazoEstandarHoras: number | null;
  plazoFueraRegionHoras: number | null;
  /** "HH:MM" */
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  banco: string | null;
  cuentaBancaria: string | null;
  estado: ProveedorEstado;
  comisionPct: number | null;
  entregasATiempoPct: number | null;
  creadaEn: Date;
  /** Regiones con alguna zona de despacho (proveedor_cobertura). */
  regiones: string[];
  /** Usuarios activos de la organizacion: el contacto de operaciones. */
  equipo: Array<{ nombre: string; email: string; telefono: string | null }>;
}

export interface NuevaDireccionPerfil {
  calle: string;
  numero: string | null;
  complemento: string | null;
  comunaId: number;
}

export interface CambiosPerfilProveedor {
  nombreFantasia?: string;
  giro?: string | null;
  emailContacto?: string;
  telefono?: string | null;
  plazoEstandarHoras?: number;
  plazoFueraRegionHoras?: number | null;
  horaCorte?: string | null;
  despachoGratisDesde?: number | null;
  ofreceDespacho?: boolean;
  ofreceRetiro?: boolean;
  banco?: string | null;
  cuentaBancaria?: string | null;
  /** Se inserta una direccion nueva y la organizacion pasa a apuntar a ella. */
  direccion?: NuevaDireccionPerfil;
  /** Igual para el punto de retiro principal; si no hay, se crea. */
  bodega?: NuevaDireccionPerfil & { nombre: string; horario: string | null };
}

export interface ProveedorRepository {
  /** null si no existe o no es tipo proveedor (KAN-108). */
  perfil(proveedorId: number): Promise<PerfilProveedor | null>;
  /** Transaccion: organizacion, direcciones nuevas, punto de retiro principal y auditoria. */
  actualizarPerfil(proveedorId: number, cambios: CambiosPerfilProveedor, auditoria: RegistroAuditoria): Promise<void>;
  /** Condiciones de entrega y zonas de despacho del proveedor (KAN-102, se editan en KAN-109). */
  cobertura(proveedorId: number): Promise<CondicionesEntregaProveedor>;
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
