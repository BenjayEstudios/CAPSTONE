import { HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { ApiErrorBody, LoginRequest, LoginResponse, MeResponse, ROL_ADMINISTRADOR } from "../models/auth.models";
import { SessionState } from "../state/session.state";

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionState);
  private restauracion: Promise<boolean> | null = null;

  async login(credenciales: LoginRequest): Promise<void> {
    let res: LoginResponse;
    try {
      res = await firstValueFrom(this.api.post<LoginResponse>("/auth/admin/login", credenciales));
    } catch (err) {
      throw this.traducirError(err);
    }
    if (res.usuario.rol !== ROL_ADMINISTRADOR) {
      throw new AuthError("ROL_NO_PERMITIDO", "Esta cuenta no tiene acceso a la administración del sistema.");
    }
    this.session.iniciar(res.token, res.usuario);
  }

  logout(): void {
    this.session.limpiar();
  }

  /**
   * Valida la sesion contra GET /auth/me (refresca permisos). Devuelve true
   * solo si hay sesion valida de administrador. Las llamadas concurrentes
   * comparten una unica peticion.
   */
  restaurar(): Promise<boolean> {
    if (this.session.autenticado()) return Promise.resolve(this.session.esAdministrador());
    if (!this.session.token()) return Promise.resolve(false);
    this.restauracion ??= this.cargarMe().finally(() => (this.restauracion = null));
    return this.restauracion;
  }

  private async cargarMe(): Promise<boolean> {
    this.session.validando.set(true);
    try {
      const { usuario } = await firstValueFrom(this.api.get<MeResponse>("/auth/me"));
      if (usuario.rol !== ROL_ADMINISTRADOR) {
        this.session.limpiar();
        return false;
      }
      this.session.actualizarUsuario(usuario);
      return true;
    } catch (err) {
      // 401: el interceptor ya limpio la sesion. 403: sin acceso, se limpia.
      // Otros errores (red, 5xx): no se pudo validar; se conserva el token y
      // se pide volver a entrar.
      if (err instanceof HttpErrorResponse && err.status === 403) this.session.limpiar();
      return false;
    } finally {
      this.session.validando.set(false);
    }
  }

  private traducirError(err: unknown): AuthError {
    if (!(err instanceof HttpErrorResponse)) return new AuthError("DESCONOCIDO", "Ocurrió un error inesperado.");
    const code = (err.error as ApiErrorBody | null)?.error?.code ?? "";
    if (err.status === 0) return new AuthError("RED", "No se pudo conectar con el servidor. Inténtalo nuevamente.");
    if (err.status === 401) return new AuthError(code || "CREDENCIALES_INVALIDAS", "Correo o clave incorrectos.");
    if (err.status === 403 && code === "MFA_NO_IMPLEMENTADO") {
      return new AuthError(code, "Tu cuenta requiere verificación en dos pasos (2FA), que aún no está disponible.");
    }
    if (err.status === 403) {
      return new AuthError(code || "PROHIBIDO", "Esta cuenta no tiene acceso a la administración del sistema.");
    }
    if (err.status >= 500) return new AuthError(code || "SERVIDOR", "El servidor tuvo un problema. Inténtalo más tarde.");
    return new AuthError(code || "DESCONOCIDO", "No se pudo iniciar sesión.");
  }
}
