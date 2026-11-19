import type {
  EntidadReferenciada,
  EventoModeracion,
  ModeracionCaso,
  ModeracionEstado,
  ModeracionTipo,
  UsuarioInterno
} from "../entities/moderacion-caso.entity.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

export interface FiltrosCasos {
  tipo?: ModeracionTipo;
  estado?: ModeracionEstado;
  /** id de usuario o "sin_asignar". */
  asignadoA?: number | "sin_asignar";
  pagina: number;
  tamano: number;
}

export interface NuevoCaso {
  tipo: ModeracionTipo;
  entidad: string;
  entidadId: number;
  detalle: string | null;
}

export interface CambioCaso {
  estado?: ModeracionEstado;
  /** undefined = no tocar; null = quitar asignacion. */
  asignadoA?: number | null;
  resueltoEn?: Date | null;
}

// Puerto de persistencia de moderacion_caso. Las escrituras llevan su fila de
// auditoria_log y ocurren en UNA transaccion.
export interface ModeracionRepository {
  /** Orden: abiertos primero, luego creadoEn ascendente, luego id. */
  listar(f: FiltrosCasos): Promise<{ items: ModeracionCaso[]; total: number }>;
  buscarPorId(id: number): Promise<ModeracionCaso | null>;
  buscarAbierto(tipo: ModeracionTipo, entidad: string, entidadId: number): Promise<ModeracionCaso | null>;
  historial(id: number): Promise<EventoModeracion[]>;
  /** null si la entidad no existe o no se sabe resolver. */
  resolverEntidad(entidad: string, entidadId: number): Promise<EntidadReferenciada | null>;
  usuariosInternos(): Promise<UsuarioInterno[]>;
  /** auditoria recibe el id creado. */
  crear(input: NuevoCaso, auditoria: (casoId: number) => RegistroAuditoria): Promise<ModeracionCaso>;
  /** Aplica el cambio solo si el caso sigue "abierto"; null si ya no lo estaba. */
  cambiar(id: number, cambio: CambioCaso, auditoria: RegistroAuditoria): Promise<ModeracionCaso | null>;
}
