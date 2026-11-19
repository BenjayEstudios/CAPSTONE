import {
  reenviarMfaSchema,
  verificarMfaSchema,
  type DesafioMfaClaims,
  type LoginAdminResultadoDto,
  type ReenviarMfaDto,
  type ServicioCorreo,
  type TokenClaims,
  type UsuarioConContexto,
  type UsuarioRepository,
  type VerificarMfaDto
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { plantillaCodigoVerificacion } from "./correos.js";
import { aSesionUsuario } from "./login-admin.use-case.js";

export const MFA_VALIDEZ_MIN = 5;
export const MFA_MAX_INTENTOS = 5;
export const MFA_MAX_REENVIOS = 3;

// Estado en memoria (sin BD): intentos fallidos y reenvios por usuario dentro
// de una ventana, y desafios ya usados (un solo uso mientras el proceso viva).
export interface ControlMfa {
  /** false si el usuario agoto sus intentos en la ventana. */
  puedeIntentar(sub: string): boolean;
  registrarFallo(sub: string): void;
  /** false si el usuario agoto sus reenvios en la ventana. */
  registrarReenvio(sub: string): boolean;
  estaUsado(jti: string): boolean;
  marcarUsado(jti: string): void;
  limpiar(sub: string): void;
}

export function crearControlMfa(
  opts: { ventanaMs?: number; maxIntentos?: number; maxReenvios?: number; ahora?: () => number } = {}
): ControlMfa {
  const ventana = opts.ventanaMs ?? MFA_VALIDEZ_MIN * 60_000;
  const maxIntentos = opts.maxIntentos ?? MFA_MAX_INTENTOS;
  const maxReenvios = opts.maxReenvios ?? MFA_MAX_REENVIOS;
  const ahora = opts.ahora ?? Date.now;
  type Contador = { n: number; reinicia: number };
  const fallos = new Map<string, Contador>();
  const reenvios = new Map<string, Contador>();
  const usados = new Map<string, number>();

  const barrer = () => {
    const t = ahora();
    if (usados.size > 10_000) for (const [k, v] of usados) if (v <= t) usados.delete(k);
    if (fallos.size > 10_000) fallos.clear();
    if (reenvios.size > 10_000) reenvios.clear();
  };
  const vigente = (m: Map<string, Contador>, k: string): Contador => {
    const c = m.get(k);
    if (!c || c.reinicia <= ahora()) {
      const nuevo = { n: 0, reinicia: ahora() + ventana };
      m.set(k, nuevo);
      return nuevo;
    }
    return c;
  };

  return {
    puedeIntentar: (sub) => vigente(fallos, sub).n < maxIntentos,
    registrarFallo: (sub) => {
      barrer();
      vigente(fallos, sub).n += 1;
    },
    registrarReenvio: (sub) => {
      const c = vigente(reenvios, sub);
      if (c.n >= maxReenvios) return false;
      c.n += 1;
      return true;
    },
    estaUsado: (jti) => (usados.get(jti) ?? 0) > ahora(),
    marcarUsado: (jti) => {
      barrer();
      usados.set(jti, ahora() + ventana);
    },
    limpiar: (sub) => {
      fallos.delete(sub);
    }
  };
}

export interface DepsMfa {
  /** Primitivas criptograficas inyectadas (application no depende de node:crypto). */
  generarCodigo: () => string; // 6 digitos, CSPRNG
  nuevoId: () => string;
  hashCodigo: (sub: string, codigo: string) => string; // HMAC-SHA256 hex con JWT_SECRET
  igualesSeguro: (a: string, b: string) => boolean; // tiempo constante
  servicioCorreo: ServicioCorreo;
  firmarDesafio: (claims: DesafioMfaClaims) => string;
  /** Devuelve los claims o null si la firma es invalida, expiro o no es de tipo mfa. */
  verificarDesafio: (token: string) => DesafioMfaClaims | null;
  control: ControlMfa;
}

// Genera el codigo, lo envia por correo y devuelve el desafio firmado.
// El codigo jamas se registra ni se devuelve.
export async function emitirDesafioMfa(deps: DepsMfa, ctx: UsuarioConContexto): Promise<string> {
  const codigo = deps.generarCodigo();
  const sub = String(ctx.usuario.id);
  const desafio = deps.firmarDesafio({
    sub,
    tipo: "mfa",
    hash: deps.hashCodigo(sub, codigo),
    jti: deps.nuevoId()
  });
  await deps.servicioCorreo.enviar(
    plantillaCodigoVerificacion({ para: ctx.usuario.email, nombre: ctx.usuario.nombre, codigo, minutosValidez: MFA_VALIDEZ_MIN })
  );
  return desafio;
}

const mfaInvalido = () => new ErrorAplicacion(401, "MFA_INVALIDO", "Codigo invalido o expirado");
const mfaBloqueado = () =>
  new ErrorAplicacion(429, "MFA_DEMASIADOS_INTENTOS", "Demasiados intentos, vuelve a iniciar sesion mas tarde");

async function cargarUsuario(repo: UsuarioRepository, sub: string) {
  const ctx = await repo.buscarPorId(Number(sub));
  if (!ctx) throw mfaInvalido();
  if (ctx.usuario.estado !== "activo" && ctx.usuario.estado !== "invitado") throw mfaInvalido();
  if (ctx.organizacion.tipo !== "interna" || ctx.usuario.mfaEstado !== "activo") throw mfaInvalido();
  return ctx;
}

export function verificarMfaAdmin(deps: {
  usuarioRepository: UsuarioRepository;
  mfa: DepsMfa;
  firmarToken: (claims: TokenClaims) => string;
  ahora?: () => Date;
}) {
  const ahora = deps.ahora ?? (() => new Date());
  return async (input: VerificarMfaDto): Promise<LoginAdminResultadoDto> => {
    const parsed = verificarMfaSchema.safeParse(input);
    if (!parsed.success) throw mfaInvalido();
    const claims = deps.mfa.verificarDesafio(parsed.data.desafio);
    if (!claims || claims.tipo !== "mfa") throw mfaInvalido();
    const { control } = deps.mfa;
    if (control.estaUsado(claims.jti)) throw mfaInvalido();
    if (!control.puedeIntentar(claims.sub)) throw mfaBloqueado();

    const ok = deps.mfa.igualesSeguro(claims.hash, deps.mfa.hashCodigo(claims.sub, parsed.data.codigo));
    if (!ok) {
      control.registrarFallo(claims.sub);
      throw mfaInvalido();
    }

    const ctx = await cargarUsuario(deps.usuarioRepository, claims.sub);
    control.marcarUsado(claims.jti);
    control.limpiar(claims.sub);
    await deps.usuarioRepository.registrarUltimoAcceso(ctx.usuario.id, ahora());
    const token = deps.firmarToken({
      sub: String(ctx.usuario.id),
      organizacionId: ctx.usuario.organizacionId,
      rol: ctx.rol.codigo
    });
    return { token, usuario: aSesionUsuario(ctx) };
  };
}

export function reenviarMfaAdmin(deps: { usuarioRepository: UsuarioRepository; mfa: DepsMfa }) {
  return async (input: ReenviarMfaDto): Promise<{ mfaRequerido: true; desafio: string }> => {
    const parsed = reenviarMfaSchema.safeParse(input);
    if (!parsed.success) throw mfaInvalido();
    const claims = deps.mfa.verificarDesafio(parsed.data.desafio);
    if (!claims || claims.tipo !== "mfa") throw mfaInvalido();
    const { control } = deps.mfa;
    if (control.estaUsado(claims.jti)) throw mfaInvalido();
    if (!control.registrarReenvio(claims.sub)) throw mfaBloqueado();
    const ctx = await cargarUsuario(deps.usuarioRepository, claims.sub);
    control.marcarUsado(claims.jti); // el desafio anterior queda invalidado
    return { mfaRequerido: true, desafio: await emitirDesafioMfa(deps.mfa, ctx) };
  };
}
