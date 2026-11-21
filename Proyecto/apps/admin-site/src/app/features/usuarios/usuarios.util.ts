import { EstadoUsuario, MfaEstado, OrdenUsuarios } from "../../core/models/usuarios.models";

export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;
export const TAMANO_POR_DEFECTO = 20;

export const ETIQUETA_ORDEN: Record<OrdenUsuarios, string> = {
  reciente: "Más recientes",
  antiguo: "Más antiguos",
  nombre_asc: "Nombre (A → Z)",
  nombre_desc: "Nombre (Z → A)"
};
export const ORDENES = Object.keys(ETIQUETA_ORDEN) as OrdenUsuarios[];

/** Valores de la URL son entrada del usuario: cualquier cosa fuera de lo permitido vuelve al valor por defecto. */
export function leerOrden(v: string | null): OrdenUsuarios {
  return ORDENES.includes(v as OrdenUsuarios) ? (v as OrdenUsuarios) : "reciente";
}
export function leerTamano(v: string | null): number {
  const n = Number(v);
  return (TAMANOS_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
}
export function leerPagina(v: string | null): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

/** Click repetido en la cabecera "Usuario": A→Z, luego Z→A, luego vuelve a "más recientes". */
export function siguienteOrdenPorNombre(actual: OrdenUsuarios): OrdenUsuarios {
  if (actual === "nombre_asc") return "nombre_desc";
  if (actual === "nombre_desc") return "reciente";
  return "nombre_asc";
}

const numero = (n: number) => n.toLocaleString("es-CL");

/** "Mostrando 21–40 de 1.234" | "… de más de 10.000" (conteo acotado) | "Sin resultados". */
export function resumenResultados(r: { pagina: number; tamano: number; cantidad: number; total: number; totalExacto: boolean }): string {
  if (r.cantidad === 0) return "Sin resultados";
  const desde = (r.pagina - 1) * r.tamano + 1;
  const hasta = desde + r.cantidad - 1;
  const total = r.totalExacto ? numero(r.total) : `más de ${numero(r.total)}`;
  return `Mostrando ${numero(desde)}–${numero(hasta)} de ${total}`;
}

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
