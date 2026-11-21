import { HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import {
  ApiErrorBody,
  LoginResponse,
  MeResponse,
  MfaRequeridoResponse,
  RegistroCompradorRequest,
  RegistroProveedorRequest,
  RegistroProveedorResponse
} from "../models/auth.models";
import { SessionState } from "../state/session.state";

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

// Textos para la persona (el message del backend esta pensado para
// desarrolladores y va sin tildes).
const MENSAJES: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Correo o contraseña incorrectos.",
  USUARIO_NO_ACTIVO: "Tu cuenta todavía no está activa. Te avisaremos por correo cuando se apruebe.",
  CUENTA_INTERNA: "Esta cuenta es del equipo Cotizapp: ingresa por el panel de administración.",
  EMAIL_EN_USO: "Ya existe una cuenta con ese correo. Ingresa o recupera tu contraseña.",
  RUT_EN_USO: "Ya hay una cuenta registrada con ese RUT.",
  ENLACE_INVALIDO: "El enlace no es válido o ya expiró. Pide uno nuevo.",
  RATE_LIMIT: "Hiciste demasiados intentos. Espera unos minutos y vuelve a probar.",
  RED: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez.",
  SERVIDOR: "Tuvimos un problema. Inténtalo de nuevo en unos minutos."
};

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionState);
  private confirmacion: Promise<boolean> | null = null;

  // Ingreso de compradores y proveedores. Los usuarios internos usan
  // admin-site: aqui se rechazan sin guardar el token.
  async ingresar(email: string, clave: string): Promise<void> {
    const res = await this.llamar(() => this.api.post<LoginResponse | MfaRequeridoResponse>("/auth/login", { email, clave }));
    if ("mfaRequerido" in res || res.usuario.organizacion.tipo === "interna") {
      throw new AuthError("CUENTA_INTERNA", MENSAJES["CUENTA_INTERNA"]);
    }
    this.session.iniciar(res.token, res.usuario);
  }

  // El registro deja la sesion iniciada.
  async registrarComprador(datos: RegistroCompradorRequest): Promise<void> {
    const res = await this.llamar(() => this.api.post<LoginResponse>("/auth/registro/comprador", datos));
    this.session.iniciar(res.token, res.usuario);
  }

  // Solicitud de alta de distribuidor (KAN-100): queda en revision, sin sesion.
  registrarProveedor(datos: RegistroProveedorRequest): Promise<RegistroProveedorResponse> {
    return this.llamar(() => this.api.post<RegistroProveedorResponse>("/auth/registro/proveedor", datos));
  }

  // Responde igual exista o no el correo (el backend no lo revela).
  async solicitarRecuperacion(email: string): Promise<void> {
    await this.llamar(() => this.api.post<{ ok: true }>("/auth/recuperar", { email }));
  }

  async restablecerClave(token: string, clave: string): Promise<void> {
    await this.llamar(() => this.api.post<{ ok: true }>("/auth/restablecer", { token, clave }));
  }

  salir(): void {
    this.session.limpiar();
  }

  /**
   * true si hay una sesion valida. La primera vez en cada carga de la pagina
   * la confirma con GET /auth/me (permisos frescos; un token expirado da 401
   * y el interceptor limpia la sesion). Las llamadas simultaneas comparten
   * una sola peticion.
   */
  confirmarSesion(): Promise<boolean> {
    if (!this.session.autenticado()) return Promise.resolve(false);
    if (this.session.confirmada()) return Promise.resolve(true);
    this.confirmacion ??= firstValueFrom(this.api.get<MeResponse>("/auth/me"))
      .then((me) => {
        this.session.actualizar(me);
        return true;
      })
      .catch((err: unknown) => {
        // 401: el interceptor ya limpio. Error de red: se conserva la sesion guardada.
        if (err instanceof HttpErrorResponse && err.status === 0) return this.session.autenticado();
        this.session.limpiar();
        return false;
      })
      .finally(() => (this.confirmacion = null));
    return this.confirmacion;
  }

  private async llamar<T>(fn: () => import("rxjs").Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(fn());
    } catch (err) {
      throw traducirError(err);
    }
  }
}

export function traducirError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  if (!(err instanceof HttpErrorResponse)) return new AuthError("DESCONOCIDO", MENSAJES["SERVIDOR"]);
  if (err.status === 0) return new AuthError("RED", MENSAJES["RED"]);
  const cuerpo = (err.error as ApiErrorBody | null)?.error;
  const code = cuerpo?.code ?? (err.status >= 500 ? "SERVIDOR" : "DESCONOCIDO");
  if (MENSAJES[code]) return new AuthError(code, MENSAJES[code]);
  if (err.status === 429) return new AuthError("RATE_LIMIT", MENSAJES["RATE_LIMIT"]);
  if (err.status >= 500) return new AuthError(code, MENSAJES["SERVIDOR"]);
  return new AuthError(code, "Revisa los datos e inténtalo de nuevo.");
}
