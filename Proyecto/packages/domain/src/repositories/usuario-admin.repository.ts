import type { UsuarioEstado, UsuarioMfaEstado } from "../entities/usuario.entity.js";
import type { OrganizacionTipo } from "../entities/organizacion.entity.js";
import type { BuscarOrganizacionesQueryDto, ListarUsuariosQueryDto } from "../dtos/usuario.dto.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

// Vista administrativa de un usuario: NUNCA incluye hashClave.
export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rut: string | null;
  telefono: string | null;
  rol: { id: number; codigo: string; nombre: string };
  organizacion: { id: number; razonSocial: string; tipo: OrganizacionTipo };
  ultimoAcceso: Date | null;
  mfaEstado: UsuarioMfaEstado;
  estado: UsuarioEstado;
}

// Solo catalogos acotados (roles). Las organizaciones crecen sin limite: se buscan con `buscarOrganizaciones`.
export interface OpcionesUsuario {
  roles: Array<{ id: number; codigo: string; nombre: string }>;
}

export interface OrganizacionOpcion {
  id: number;
  razonSocial: string;
  rut: string;
  tipo: OrganizacionTipo;
  estado: string;
}

export interface ListadoUsuarios {
  items: UsuarioAdmin[];
  /** Total contado hasta `TOPE_CONTEO`; si lo alcanza, `totalExacto` es false y el real es mayor. */
  total: number;
  totalExacto: boolean;
  /** Hay una pagina siguiente (se lee una fila de mas, sin depender del conteo). */
  hayMas: boolean;
}

/** Tope del conteo: contar hasta aqui cuesta lo mismo con 10 mil o con 10 millones de filas. */
export const TOPE_CONTEO = 10_000;

export interface NuevoUsuario {
  organizacionId: number;
  rolId: number;
  nombre: string;
  email: string;
  rut: string | null;
  telefono: string | null;
  hashClave: string;
  mfaEstado: UsuarioMfaEstado;
}

export interface CambiosUsuario {
  nombre?: string;
  rolId?: number;
  organizacionId?: number;
  telefono?: string | null;
  mfaEstado?: UsuarioMfaEstado;
}

// Puerto de administracion de usuarios. Cada escritura registra auditoria en
// la MISMA transaccion.
export interface UsuarioAdminRepository {
  listar(f: ListarUsuariosQueryDto): Promise<ListadoUsuarios>;
  obtener(id: number): Promise<UsuarioAdmin | null>;
  opciones(): Promise<OpcionesUsuario>;
  buscarOrganizaciones(f: BuscarOrganizacionesQueryDto): Promise<OrganizacionOpcion[]>;
  existeRol(id: number): Promise<boolean>;
  existeOrganizacion(id: number): Promise<boolean>;
  /** Usuarios activos cuyo rol tiene `codigo` en nivel total. */
  contarActivosConPermisoTotal(codigo: string): Promise<number>;
  crear(datos: NuevoUsuario, auditoria: (id: number) => RegistroAuditoria): Promise<number>;
  actualizar(id: number, cambios: CambiosUsuario, auditoria: RegistroAuditoria): Promise<void>;
  cambiarEstado(id: number, estado: UsuarioEstado, auditoria: RegistroAuditoria): Promise<void>;
}
