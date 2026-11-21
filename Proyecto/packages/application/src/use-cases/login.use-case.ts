import bcrypt from "bcryptjs";
import {
  loginSchema,
  type LoginDto,
  type LoginResultadoDto,
  type MfaRequeridoDto,
  type TokenClaims,
  type UsuarioConContexto,
  type UsuarioRepository,
  type UsuarioSesionConOrgDto
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { aSesionUsuario } from "./login-admin.use-case.js";
import { emitirDesafioMfa, exigeMfa, type DepsMfa } from "./mfa-admin.use-case.js";

const HASH_DUMMY = bcrypt.hashSync("cotizapp-dummy", 10);

const credencialesInvalidas = () => new ErrorAplicacion(401, "CREDENCIALES_INVALIDAS", "Correo o clave incorrectos");
const noActivo = () =>
  new ErrorAplicacion(403, "USUARIO_NO_ACTIVO", "Tu cuenta todavia no esta activa. Te avisaremos cuando se apruebe.");

export function aSesionConOrganizacion(ctx: UsuarioConContexto): UsuarioSesionConOrgDto {
  return {
    ...aSesionUsuario(ctx),
    organizacion: {
      id: ctx.organizacion.id,
      nombre: ctx.organizacion.nombre ?? "",
      tipo: ctx.organizacion.tipo
    }
  };
}

// POST /auth/login (KAN-144): login unico de ecommerce, mobile y admin-site.
// No filtra por rol (cada app decide que roles acepta). Los internos con 2FA
// exigido reciben { mfaRequerido, enrolar, desafio } y siguen en
// /auth/admin/mfa (o /auth/admin/mfa/enrolar si enrolar = true).
// El usuario "invitado" puede entrar: su primer acceso lo pasa a activo
// (registrarUltimoAcceso), igual que en el login del admin.
export function login(deps: {
  usuarioRepository: UsuarioRepository;
  firmarToken: (claims: TokenClaims) => string;
  mfa?: DepsMfa;
  ahora?: () => Date;
}) {
  const ahora = deps.ahora ?? (() => new Date());

  return async (input: LoginDto): Promise<LoginResultadoDto | MfaRequeridoDto> => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new ErrorAplicacion(400, "VALIDACION", "Email o clave con formato invalido");
    const { email, clave } = parsed.data;

    const ctx = await deps.usuarioRepository.buscarPorEmail(email);
    const claveOk = await bcrypt.compare(clave, ctx?.usuario.hashClave ?? HASH_DUMMY);
    // Mismo error si el email no existe o la clave no calza.
    if (!ctx || !claveOk) throw credencialesInvalidas();
    // Solo despues de validar la clave se revela el estado de la cuenta.
    if (ctx.usuario.estado === "suspendido" || ctx.organizacion.estado !== "activa") throw noActivo();

    if (exigeMfa(ctx)) {
      if (!deps.mfa) {
        throw new ErrorAplicacion(403, "MFA_NO_IMPLEMENTADO", "El segundo factor de autenticacion no esta disponible");
      }
      return emitirDesafioMfa(deps.mfa, ctx);
    }

    await deps.usuarioRepository.registrarUltimoAcceso(ctx.usuario.id, ahora());
    const token = deps.firmarToken({
      sub: String(ctx.usuario.id),
      organizacionId: ctx.usuario.organizacionId,
      rol: ctx.rol.codigo
    });
    return { token, usuario: aSesionConOrganizacion(ctx) };
  };
}
