import type { OrganizacionEstado } from "../entities/organizacion.entity.js";
import type { UsuarioEstado } from "../entities/usuario.entity.js";

// Datos de una cuenta nueva: organizacion + su primer usuario, que se crean
// juntos en una transaccion (registro de comprador o proveedor).
export interface NuevaCuenta {
  organizacion: {
    tipo: "cliente" | "proveedor";
    razonSocial: string;
    rut: string;
    nombreFantasia: string | null;
    giro: string | null;
    emailContacto: string;
    telefono: string | null;
    estado: OrganizacionEstado;
  };
  usuario: {
    nombre: string;
    email: string;
    rut: string | null;
    telefono: string | null;
    hashClave: string;
    estado: UsuarioEstado;
  };
  /** Codigo del rol del usuario (ej. "comprador", "proveedor"). */
  rolCodigo: string;
}

export type ResultadoCrearCuenta =
  | { ok: true; usuarioId: number; organizacionId: number }
  | { ok: false; conflicto: "email" | "rut" | "rol_inexistente" };

// Puerto de alta de cuentas y cambio de clave. Implementacion en
// @cotizapp/infrastructure (DrizzleCuentaRepository).
export interface CuentaRepository {
  /** Crea organizacion + usuario en una transaccion. Si el email o el RUT ya existen, no crea nada. */
  crear(cuenta: NuevaCuenta): Promise<ResultadoCrearCuenta>;
  actualizarClave(usuarioId: number, hashClave: string): Promise<void>;
  /** Inicio del enrolamiento: guarda el secreto TOTP cifrado con mfa_estado = pendiente. */
  guardarSecretoMfaPendiente(usuarioId: number, secretoCifrado: string): Promise<void>;
  /** Fin del enrolamiento (el primer codigo calzo): mfa_estado = activo. */
  activarMfa(usuarioId: number): Promise<void>;
}
