import { HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { ApiErrorBody, LoginRequest, LoginResponse, LoginRespuesta, MeResponse, MfaRequeridoResponse, UsuarioSesion } from "../models/auth.models";
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

  /** Desafio 2FA pendiente (solo en memoria; el token no existe hasta completar el paso 2). */
  readonly desafioMfa = signal<string | null>(null);

  /** Paso 1. Devuelve "mfa" si hay que ingresar el codigo; "sesion" si ya entro. */
  async login(credenciales: LoginRequest): Promise<"sesion" | "mfa"> {
    this.desafioMfa.set(null);
    let res: LoginRespuesta;
    try {
      res = await firstValueFrom(this.api.post<LoginRespuesta>("/auth/admin/login", credenciales));
    } catch (err) {
      throw this.traducirError(err);
    }
    if ("mfaRequerido" in res) {
      this.desafioMfa.set(res.desafio);
      return "mfa";
    }
    this.session.iniciar(res.token, res.usuario);
    return "sesion";
  }

  /** Paso 2: codigo de 6 digitos. Un fallo (invalido/expirado/bloqueado) descarta el desafio. */
  async verificarMfa(codigo: string): Promise<void> {
    const desafio = this.desafioMfa();
    if (!desafio) throw new AuthError("MFA_INVALIDO", "La verificación expiró. Vuelve a iniciar sesión.");
    let res: LoginResponse;
    try {
      res = await firstValueFrom(this.api.post<LoginResponse>("/auth/admin/mfa", { desafio, codigo }));
    } catch (err) {
      const e = this.traducirError(err);
      if (e.code !== "RED" && e.code !== "SERVIDOR") this.desafioMfa.set(null);
      throw e;
    }
    this.desafioMfa.set(null);
    this.session.iniciar(res.token, res.usuario);
  }

  /** Pide un codigo nuevo; reemplaza el desafio anterior. */
  async reenviarMfa(): Promise<void> {
    const desafio = this.desafioMfa();
    if (!desafio) throw new AuthError("MFA_INVALIDO", "La verificación expiró. Vuelve a iniciar sesión.");
    try {
      const res = await firstValueFrom(this.api.post<MfaRequeridoResponse>("/auth/admin/mfa/reenviar", { desafio }));
      this.desafioMfa.set(res.desafio);
    } catch (err) {
      const e = this.traducirError(err);
      if (e.code !== "RED" && e.code !== "SERVIDOR") this.desafioMfa.set(null);
      throw e;
    }
  }

  cancelarMfa(): void {
    this.desafioMfa.set(null);
  }

  logout(): void {
    this.session.limpiar();
  }

  /**
   * Valida la sesion contra GET /auth/me (refresca permisos). Devuelve true
   * solo si hay sesion valida (el backend decide quien entra). Las llamadas concurrentes
   * comparten una unica peticion.
   */
  restaurar(): Promise<boolean> {
    if (this.session.autenticado()) return Promise.resolve(true);
    if (!this.session.token()) return Promise.resolve(false);
    this.restauracion ??= this.cargarMe().finally(() => (this.restauracion = null));
    return this.restauracion;
  }

  private async cargarMe(): Promise<boolean> {
    this.session.validando.set(true);
    try {
      // GET /auth/me devuelve el usuario plano; se tolera tambien { usuario }.
      const res = await firstValueFrom(this.api.get<MeResponse | UsuarioSesion>("/auth/me"));
      const usuario = "usuario" in res ? res.usuario : res;
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
    if (err.status === 401 && code === "MFA_INVALIDO") {
      return new AuthError(code, "El código es incorrecto o expiró. Vuelve a iniciar sesión.");
    }
    if (err.status === 429 && code === "MFA_DEMASIADOS_INTENTOS") {
      return new AuthError(code, "Demasiados intentos. Vuelve a iniciar sesión más tarde.");
    }
    if (err.status === 429) return new AuthError("RATE_LIMIT", "Demasiadas solicitudes. Inténtalo en unos minutos.");
    if (err.status === 401) return new AuthError(code || "CREDENCIALES_INVALIDAS", "Correo o clave incorrectos.");
    if (err.status === 403 && code === "MFA_NO_IMPLEMENTADO") {
      return new AuthError(code, "La verificación en dos pasos no está disponible en este momento.");
    }
    if (err.status === 403) {
      return new AuthError(code || "PROHIBIDO", "Esta cuenta no tiene acceso al panel.");
    }
    if (err.status >= 500) return new AuthError(code || "SERVIDOR", "El servidor tuvo un problema. Inténtalo más tarde.");
    return new AuthError(code || "DESCONOCIDO", "No se pudo iniciar sesión.");
  }
}
