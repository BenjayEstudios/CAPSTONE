import {
  confirmarEnrolamientoMfaSchema,
  iniciarEnrolamientoMfaSchema,
  verificarMfaSchema,
  type ConfirmarEnrolamientoMfaDto,
  type CuentaRepository,
  type DesafioMfaClaims,
  type EnrolamientoMfaDto,
  type IniciarEnrolamientoMfaDto,
  type LoginAdminResultadoDto,
  type MfaRequeridoDto,
  type TokenClaims,
  type UsuarioConContexto,
  type UsuarioRepository,
  type VerificarMfaDto
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { aSesionUsuario } from "./login-admin.use-case.js";

// 2FA TOTP (RFC 6238) para usuarios internos — KAN-144. Reemplaza el codigo
// por correo de KAN-112 (ver docs/decisiones/DECISIONES-CERRADAS.md).
//
// Estados (usuario.mfa_estado):
// - pendiente: 2FA exigido y aun sin enrolar -> el login pide enrolarse.
// - activo:    enrolado (tiene mfa_secreto) -> el login pide el codigo.
//              "activo" sin secreto (lo puso un admin a mano) se trata como pendiente.
// - opcional / inactivo: el login no pide 2FA.

export const MFA_VALIDEZ_MIN = 5;
/** El enrolamiento da mas tiempo: hay que instalar la app y escanear el QR. */
export const MFA_ENROLAMIENTO_VALIDEZ_MIN = 10;
export const MFA_MAX_INTENTOS = 5;

// Estado en memoria (sin BD): intentos fallidos por usuario dentro de una
// ventana, y claves de un solo uso (jti de desafios y "sub:paso" de codigos
// TOTP ya aceptados, para que un codigo no sirva dos veces).
export interface ControlMfa {
  /** false si el usuario agoto sus intentos en la ventana. */
  puedeIntentar(sub: string): boolean;
  registrarFallo(sub: string): void;
  estaUsado(clave: string): boolean;
  marcarUsado(clave: string): void;
  limpiar(sub: string): void;
}

export function crearControlMfa(opts: { ventanaMs?: number; maxIntentos?: number; ahora?: () => number } = {}): ControlMfa {
  const ventana = opts.ventanaMs ?? MFA_ENROLAMIENTO_VALIDEZ_MIN * 60_000;
  const maxIntentos = opts.maxIntentos ?? MFA_MAX_INTENTOS;
  const ahora = opts.ahora ?? Date.now;
  type Contador = { n: number; reinicia: number };
  const fallos = new Map<string, Contador>();
  const usados = new Map<string, number>();

  const barrer = () => {
    const t = ahora();
    if (usados.size > 10_000) for (const [k, v] of usados) if (v <= t) usados.delete(k);
    if (fallos.size > 10_000) fallos.clear();
  };
  const vigente = (k: string): Contador => {
    const c = fallos.get(k);
    if (!c || c.reinicia <= ahora()) {
      const nuevo = { n: 0, reinicia: ahora() + ventana };
      fallos.set(k, nuevo);
      return nuevo;
    }
    return c;
  };

  return {
    puedeIntentar: (sub) => vigente(sub).n < maxIntentos,
    registrarFallo: (sub) => {
      barrer();
      vigente(sub).n += 1;
    },
    estaUsado: (clave) => (usados.get(clave) ?? 0) > ahora(),
    marcarUsado: (clave) => {
      barrer();
      usados.set(clave, ahora() + ventana);
    },
    limpiar: (sub) => {
      fallos.delete(sub);
    }
  };
}

// Primitivas inyectadas por apps/backend (application no conoce JWT, node:crypto ni QR).
export interface DepsMfa {
  /** Secreto TOTP nuevo, en base32 (160 bits de CSPRNG). */
  generarSecreto: () => string;
  /** Paso de tiempo (floor(t/30)) en que calza el codigo, tolerando +-1 paso; null si no calza. */
  verificarCodigo: (secretoBase32: string, codigo: string) => number | null;
  cifrar: (secretoBase32: string) => string;
  /** null si el texto cifrado esta corrupto o se cifro con otra clave. */
  descifrar: (cifrado: string) => string | null;
  otpauthUrl: (email: string, secretoBase32: string) => string;
  qrDataUrl: (texto: string) => Promise<string>;
  nuevoId: () => string;
  firmarDesafio: (claims: DesafioMfaClaims, minutos: number) => string;
  /** Devuelve los claims o null si la firma es invalida o expiro. */
  verificarDesafio: (token: string) => DesafioMfaClaims | null;
  control: ControlMfa;
}

/** Usuarios a los que el login les exige 2FA: solo internos, con el 2FA exigido. */
export function exigeMfa(ctx: UsuarioConContexto): boolean {
  return ctx.organizacion.tipo === "interna" && (ctx.usuario.mfaEstado === "activo" || ctx.usuario.mfaEstado === "pendiente");
}

const tieneSecreto = (ctx: UsuarioConContexto) => ctx.usuario.mfaEstado === "activo" && !!ctx.usuario.mfaSecreto;

// Paso 1 del login con 2FA: segun tenga o no secreto, pide el codigo o el enrolamiento.
export function emitirDesafioMfa(deps: DepsMfa, ctx: UsuarioConContexto): MfaRequeridoDto {
  const enrolar = !tieneSecreto(ctx);
  const desafio = deps.firmarDesafio(
    { sub: String(ctx.usuario.id), tipo: enrolar ? "mfa_enrolamiento" : "mfa", jti: deps.nuevoId() },
    enrolar ? MFA_ENROLAMIENTO_VALIDEZ_MIN : MFA_VALIDEZ_MIN
  );
  return { mfaRequerido: true, enrolar, desafio };
}

const mfaInvalido = () => new ErrorAplicacion(401, "MFA_INVALIDO", "Codigo invalido o expirado");
const mfaBloqueado = () =>
  new ErrorAplicacion(429, "MFA_DEMASIADOS_INTENTOS", "Demasiados intentos, vuelve a iniciar sesion mas tarde");

function leerDesafio(deps: DepsMfa, token: string, tipo: DesafioMfaClaims["tipo"]): DesafioMfaClaims {
  const claims = deps.verificarDesafio(token);
  if (!claims || claims.tipo !== tipo || deps.control.estaUsado(claims.jti)) throw mfaInvalido();
  if (!deps.control.puedeIntentar(claims.sub)) throw mfaBloqueado();
  return claims;
}

async function cargarUsuario(repo: UsuarioRepository, sub: string) {
  const ctx = await repo.buscarPorId(Number(sub));
  if (!ctx || ctx.usuario.estado === "suspendido" || !exigeMfa(ctx)) throw mfaInvalido();
  return ctx;
}

// Compara el codigo y bloquea su reuso dentro de su ventana de 30 s.
function comprobarCodigo(deps: DepsMfa, sub: string, secreto: string, codigo: string): void {
  const paso = deps.verificarCodigo(secreto, codigo);
  if (paso === null || deps.control.estaUsado(`${sub}:${paso}`)) {
    deps.control.registrarFallo(sub);
    throw mfaInvalido();
  }
  deps.control.marcarUsado(`${sub}:${paso}`);
}

async function emitirSesion(
  deps: { usuarioRepository: UsuarioRepository; firmarToken: (c: TokenClaims) => string; ahora?: () => Date },
  ctx: UsuarioConContexto
): Promise<LoginAdminResultadoDto> {
  await deps.usuarioRepository.registrarUltimoAcceso(ctx.usuario.id, (deps.ahora ?? (() => new Date()))());
  const token = deps.firmarToken({ sub: String(ctx.usuario.id), organizacionId: ctx.usuario.organizacionId, rol: ctx.rol.codigo });
  return { token, usuario: aSesionUsuario(ctx) };
}

// POST /auth/admin/mfa: usuario enrolado, codigo de su app -> sesion.
export function verificarMfaAdmin(deps: {
  usuarioRepository: UsuarioRepository;
  mfa: DepsMfa;
  firmarToken: (claims: TokenClaims) => string;
  ahora?: () => Date;
}) {
  return async (input: VerificarMfaDto): Promise<LoginAdminResultadoDto> => {
    const parsed = verificarMfaSchema.safeParse(input);
    if (!parsed.success) throw mfaInvalido();
    const claims = leerDesafio(deps.mfa, parsed.data.desafio, "mfa");
    const ctx = await cargarUsuario(deps.usuarioRepository, claims.sub);
    const secreto = ctx.usuario.mfaSecreto ? deps.mfa.descifrar(ctx.usuario.mfaSecreto) : null;
    if (!secreto) throw mfaInvalido();

    comprobarCodigo(deps.mfa, claims.sub, secreto, parsed.data.codigo);
    deps.mfa.control.marcarUsado(claims.jti);
    deps.mfa.control.limpiar(claims.sub);
    return emitirSesion(deps, ctx);
  };
}

// POST /auth/admin/mfa/enrolar: entrega el secreto y su QR. El secreto queda
// guardado (cifrado) con mfa_estado = pendiente: si el usuario sale y vuelve
// a entrar antes de confirmar, recibe el MISMO QR, y la cuenta que ya agrego
// a su app sigue sirviendo. Recien confirmarEnrolamientoMfa lo activa.
export function iniciarEnrolamientoMfa(deps: { usuarioRepository: UsuarioRepository; cuentaRepository: CuentaRepository; mfa: DepsMfa }) {
  return async (input: IniciarEnrolamientoMfaDto): Promise<EnrolamientoMfaDto> => {
    const parsed = iniciarEnrolamientoMfaSchema.safeParse(input);
    if (!parsed.success) throw mfaInvalido();
    const claims = leerDesafio(deps.mfa, parsed.data.desafio, "mfa_enrolamiento");
    const ctx = await cargarUsuario(deps.usuarioRepository, claims.sub);
    if (tieneSecreto(ctx)) throw mfaInvalido(); // ya enrolado: debe usar POST /auth/admin/mfa

    let secreto = ctx.usuario.mfaSecreto ? deps.mfa.descifrar(ctx.usuario.mfaSecreto) : null;
    if (!secreto) {
      secreto = deps.mfa.generarSecreto();
      await deps.cuentaRepository.guardarSecretoMfaPendiente(ctx.usuario.id, deps.mfa.cifrar(secreto));
    }
    const otpauthUrl = deps.mfa.otpauthUrl(ctx.usuario.email, secreto);
    const desafio = deps.mfa.firmarDesafio(
      { sub: claims.sub, tipo: "mfa_confirmacion", jti: deps.mfa.nuevoId() },
      MFA_ENROLAMIENTO_VALIDEZ_MIN
    );
    return { secreto, otpauthUrl, qrDataUrl: await deps.mfa.qrDataUrl(otpauthUrl), desafio };
  };
}

// POST /auth/admin/mfa/confirmar: primer codigo de la app -> deja
// mfa_estado = activo y entrega la sesion.
export function confirmarEnrolamientoMfa(deps: {
  usuarioRepository: UsuarioRepository;
  cuentaRepository: CuentaRepository;
  mfa: DepsMfa;
  firmarToken: (claims: TokenClaims) => string;
  ahora?: () => Date;
}) {
  return async (input: ConfirmarEnrolamientoMfaDto): Promise<LoginAdminResultadoDto> => {
    const parsed = confirmarEnrolamientoMfaSchema.safeParse(input);
    if (!parsed.success) throw mfaInvalido();
    const claims = leerDesafio(deps.mfa, parsed.data.desafio, "mfa_confirmacion");
    const ctx = await cargarUsuario(deps.usuarioRepository, claims.sub);
    if (tieneSecreto(ctx)) throw mfaInvalido();
    const secreto = ctx.usuario.mfaSecreto ? deps.mfa.descifrar(ctx.usuario.mfaSecreto) : null;
    if (!secreto) throw mfaInvalido();

    comprobarCodigo(deps.mfa, claims.sub, secreto, parsed.data.codigo);
    await deps.cuentaRepository.activarMfa(ctx.usuario.id);
    deps.mfa.control.marcarUsado(claims.jti);
    deps.mfa.control.limpiar(claims.sub);
    return emitirSesion(deps, { ...ctx, usuario: { ...ctx.usuario, mfaEstado: "activo" } });
  };
}
