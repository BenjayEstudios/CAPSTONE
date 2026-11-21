import { computed, Injectable, signal } from "@angular/core";
import { UsuarioSesion } from "../models/auth.models";

export const SESION_STORAGE_KEY = "cotizapp.ecommerce.sesion";

interface SesionGuardada {
  token: string;
  usuario: UsuarioSesion;
}

function leer(): SesionGuardada | null {
  try {
    const crudo = localStorage.getItem(SESION_STORAGE_KEY);
    if (!crudo) return null;
    const s = JSON.parse(crudo) as Partial<SesionGuardada>;
    return s.token && s.usuario ? (s as SesionGuardada) : null;
  } catch {
    return null;
  }
}

function guardar(s: SesionGuardada | null): void {
  try {
    if (s) localStorage.setItem(SESION_STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESION_STORAGE_KEY);
  } catch {
    // Almacenamiento no disponible (modo privado o bloqueado): la sesion vive solo en memoria.
  }
}

// Sesion del comprador o proveedor (KAN-97). Se guarda el JWT y el usuario
// para que la sesion sobreviva a recargar la pagina; el backend la confirma
// con GET /auth/me cuando una ruta la exige (ver core/auth/guards.ts), y un
// 401 la limpia (core/auth/auth.interceptor.ts).
@Injectable({ providedIn: "root" })
export class SessionState {
  private readonly inicial = leer();
  readonly token = signal<string | null>(this.inicial?.token ?? null);
  readonly usuario = signal<UsuarioSesion | null>(this.inicial?.usuario ?? null);
  /** true cuando GET /auth/me ya confirmo el token en esta carga de la pagina. */
  readonly confirmada = signal(false);

  readonly autenticado = computed(() => !!this.token() && !!this.usuario());
  readonly esComprador = computed(() => this.usuario()?.organizacion.tipo === "cliente");
  readonly esProveedor = computed(() => this.usuario()?.organizacion.tipo === "proveedor");
  readonly nombreCorto = computed(() => this.usuario()?.nombre.split(/\s+/)[0] ?? "");

  iniciar(token: string, usuario: UsuarioSesion): void {
    guardar({ token, usuario });
    this.token.set(token);
    this.usuario.set(usuario);
    this.confirmada.set(true);
  }

  /** Refresca los datos del usuario (permisos) sin tocar la organizacion guardada. */
  actualizar(datos: Partial<UsuarioSesion>): void {
    const actual = this.usuario();
    const token = this.token();
    if (!actual || !token) return;
    const usuario = { ...actual, ...datos, organizacion: actual.organizacion };
    guardar({ token, usuario });
    this.usuario.set(usuario);
    this.confirmada.set(true);
  }

  limpiar(): void {
    guardar(null);
    this.token.set(null);
    this.usuario.set(null);
    this.confirmada.set(false);
  }
}
