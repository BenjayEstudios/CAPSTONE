import type { Proveedor, ProveedorEstado, ProveedorListado } from "../entities/proveedor.entity.js";
import type { ProveedorDocumento, ProveedorDocumentoRevision, ProveedorDocumentoTipo, ProveedorDocumentoVigencia } from "../entities/proveedor-documento.entity.js";

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
  /** Aditivo (KAN-109): id de la fila de proveedor_cobertura. */
  id: number;
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

export interface NuevaZona {
  comunaId: number | null;
  regionCodigo: string;
  costoDespacho: number;
  plazoHoras: number | null;
}

/** Punto de retiro del proveedor, activo o no (KAN-109). */
export interface PuntoRetiroProveedor {
  id: number;
  nombre: string;
  horario: string | null;
  activo: boolean;
  direccion: DireccionPerfil;
  /** Lo cita algun envio: no se puede borrar, solo desactivar. */
  usado: boolean;
}

export interface CambiosPuntoRetiro {
  nombre?: string;
  horario?: string | null;
  activo?: boolean;
  /** Se inserta una direccion nueva y el punto pasa a apuntar a ella. */
  direccion?: NuevaDireccionPerfil;
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
  // Cobertura y puntos de retiro (KAN-109). Cada escritura va con su
  // auditoria en la misma transaccion y filtra por proveedor (una fila de
  // otro proveedor no se toca y devuelve false).
  crearZona(proveedorId: number, zona: NuevaZona, auditoria: RegistroAuditoria): Promise<number>;
  actualizarZona(proveedorId: number, id: number, cambios: { costoDespacho?: number; plazoHoras?: number | null }, auditoria: RegistroAuditoria): Promise<boolean>;
  eliminarZona(proveedorId: number, id: number, auditoria: RegistroAuditoria): Promise<boolean>;
  puntosRetiro(proveedorId: number): Promise<PuntoRetiroProveedor[]>;
  crearPuntoRetiro(proveedorId: number, punto: { nombre: string; horario: string | null; activo: boolean; direccion: NuevaDireccionPerfil }, auditoria: RegistroAuditoria): Promise<number>;
  actualizarPuntoRetiro(proveedorId: number, id: number, cambios: CambiosPuntoRetiro, auditoria: RegistroAuditoria): Promise<boolean>;
  eliminarPuntoRetiro(proveedorId: number, id: number, auditoria: RegistroAuditoria): Promise<boolean>;
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
  /** KAN-110: un documento subido por el proveedor; queda en revision pendiente. */
  crearDocumento(
    proveedorId: number,
    documento: { tipo: ProveedorDocumentoTipo; url: string; venceEn: string | null; vigencia: ProveedorDocumentoVigencia },
    auditoria: RegistroAuditoria
  ): Promise<ProveedorDocumento>;
  buscarDocumento(documentoId: number): Promise<ProveedorDocumento | null>;
  revisarDocumento(documentoId: number, revision: RevisionDocumento, auditoria: RegistroAuditoria): Promise<ProveedorDocumento>;
  cambiarEstado(
    id: number,
    estado: ProveedorEstado,
    comisionPct: number | undefined,
    auditoria: RegistroAuditoria
  ): Promise<Proveedor>;
}
