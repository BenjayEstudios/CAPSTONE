import { EstadoUsuario, MfaEstado } from "../../core/models/usuarios.models";

export const ETIQUETA_ESTADO: Record<EstadoUsuario, string> = { invitado: "Invitado", activo: "Activo", suspendido: "Suspendido" };
export const ETIQUETA_MFA: Record<MfaEstado, string> = {
  inactivo: "Desactivado", opcional: "Opcional", pendiente: "Obligatorio (pendiente)", activo: "Activo"
};

export function mensajeErrorUsuario(e: unknown, defecto: string): string {
  const err = e as { status?: number; error?: { error?: { message?: string } } };
  if (err?.status === 0) return "No hay conexión con el servidor.";
  return err?.error?.error?.message ?? defecto;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validarFormulario(v: { nombre: string; email: string; rolId: string; organizacionId: string }, conEmail: boolean): string | null {
  if (!v.nombre.trim()) return "El nombre es obligatorio.";
  if (conEmail && !EMAIL.test(v.email.trim())) return "Ingresa un email válido.";
  if (!v.rolId) return "Selecciona un rol.";
  if (!v.organizacionId) return "Selecciona una organización.";
  return null;
}
