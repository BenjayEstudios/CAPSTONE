import bcrypt from "bcryptjs";
import {
  restablecerClaveSchema,
  solicitarRecuperacionSchema,
  type CuentaRepository,
  type RecuperacionClaims,
  type RestablecerClaveDto,
  type ServicioCorreo,
  type SolicitarRecuperacionDto,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { enviarRecuperacionContrasena } from "./correos.js";

export const RECUPERACION_VALIDEZ_MIN = 30;

// Primitivas inyectadas por apps/backend (application no conoce JWT ni node:crypto).
export interface DepsRecuperacion {
  firmar: (claims: RecuperacionClaims) => string; // expira en RECUPERACION_VALIDEZ_MIN
  /** Claims o null si la firma es invalida, expiro o no es de tipo recuperacion. */
  verificar: (token: string) => RecuperacionClaims | null;
  /** Hash corto y no reversible de hash_clave (amarra el enlace a la clave vigente). */
  huella: (hashClave: string) => string;
  igualesSeguro: (a: string, b: string) => boolean;
  /** URL base del sitio que abre el enlace (ecommerce o admin-site segun el usuario). */
  urlSitio: (tipoOrganizacion: "cliente" | "proveedor" | "interna") => string;
}

// POST /auth/recuperar: siempre responde lo mismo, exista o no el correo
// (no revela que cuentas existen). Si existe y no esta suspendida, envia
// el enlace. Un fallo del correo se registra pero no cambia la respuesta.
export function solicitarRecuperacionClave(deps: {
  usuarioRepository: UsuarioRepository;
  servicioCorreo: ServicioCorreo;
  recuperacion: DepsRecuperacion;
  alFallarCorreo?: (e: unknown) => void;
}) {
  return async (input: SolicitarRecuperacionDto): Promise<{ ok: true }> => {
    const { email } = validar(solicitarRecuperacionSchema, input);
    const ctx = await deps.usuarioRepository.buscarPorEmail(email);
    if (ctx && ctx.usuario.estado !== "suspendido") {
      const token = deps.recuperacion.firmar({
        sub: String(ctx.usuario.id),
        tipo: "recuperacion",
        huella: deps.recuperacion.huella(ctx.usuario.hashClave)
      });
      const url = `${deps.recuperacion.urlSitio(ctx.organizacion.tipo)}/restablecer-clave?token=${encodeURIComponent(token)}`;
      try {
        await enviarRecuperacionContrasena(deps.servicioCorreo, { para: ctx.usuario.email, nombre: ctx.usuario.nombre, urlRecuperacion: url });
      } catch (e) {
        deps.alFallarCorreo?.(e);
      }
    }
    return { ok: true };
  };
}

const enlaceInvalido = () =>
  new ErrorAplicacion(400, "ENLACE_INVALIDO", "El enlace no es valido o ya expiro. Solicita uno nuevo.");

// POST /auth/restablecer: valida el enlace y fija la nueva clave. El enlace
// es de un solo uso: al cambiar hash_clave su huella deja de calzar.
export function restablecerClave(deps: {
  usuarioRepository: UsuarioRepository;
  cuentaRepository: CuentaRepository;
  recuperacion: DepsRecuperacion;
}) {
  return async (input: RestablecerClaveDto): Promise<{ ok: true }> => {
    const d = validar(restablecerClaveSchema, input);
    const claims = deps.recuperacion.verificar(d.token);
    if (!claims || claims.tipo !== "recuperacion") throw enlaceInvalido();
    const ctx = await deps.usuarioRepository.buscarPorId(Number(claims.sub));
    if (!ctx || ctx.usuario.estado === "suspendido") throw enlaceInvalido();
    if (!deps.recuperacion.igualesSeguro(claims.huella, deps.recuperacion.huella(ctx.usuario.hashClave))) throw enlaceInvalido();

    await deps.cuentaRepository.actualizarClave(ctx.usuario.id, await bcrypt.hash(d.clave, 10));
    return { ok: true };
  };
}
