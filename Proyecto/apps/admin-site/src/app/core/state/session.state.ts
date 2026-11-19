import { computed, Injectable, signal } from "@angular/core";
import { ROL_ADMINISTRADOR, UsuarioSesion } from "../models/auth.models";

export const TOKEN_STORAGE_KEY = "cotizapp.admin.token";

function leerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // almacenamiento no disponible (modo privado, bloqueado): la sesion
    // vive solo en memoria.
  }
}

// Estado de sesion del administrador. Solo el token se persiste; el usuario y
// sus permisos se vuelven a pedir a GET /auth/me al arrancar.
@Injectable({ providedIn: "root" })
export class SessionState {
  readonly token = signal<string | null>(leerToken());
  readonly usuario = signal<UsuarioSesion | null>(null);
  /** true mientras se valida la sesion contra el backend (arranque). */
  readonly validando = signal(false);

  readonly autenticado = computed(() => !!this.token() && !!this.usuario());
  readonly esAdministrador = computed(() => this.usuario()?.rol === ROL_ADMINISTRADOR);

  iniciar(token: string, usuario: UsuarioSesion): void {
    guardarToken(token);
    this.token.set(token);
    this.usuario.set(usuario);
  }

  actualizarUsuario(usuario: UsuarioSesion): void {
    this.usuario.set(usuario);
  }

  limpiar(): void {
    guardarToken(null);
    this.token.set(null);
    this.usuario.set(null);
  }

  /** Un permiso habilita acceso si su nivel es "parcial" o "total". */
  tienePermiso(permiso: string): boolean {
    const nivel = this.usuario()?.permisos?.[permiso];
    return nivel === "parcial" || nivel === "total";
  }
}
