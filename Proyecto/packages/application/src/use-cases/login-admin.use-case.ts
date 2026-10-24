import bcrypt from "bcryptjs";
import {
  loginAdminSchema,
  type LoginAdminDto,
  type LoginAdminResultadoDto,
  type TokenClaims,
  type UsuarioConContexto,
  type UsuarioRepository,
  type UsuarioSesionDto
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

// Hash descartable para gastar el mismo tiempo de bcrypt cuando el email no
// existe (evita distinguir "no existe" de "clave mala" por tiempos).
const HASH_DUMMY = bcrypt.hashSync("cotizapp-dummy", 10);

const credencialesInvalidas = () =>
  new ErrorAplicacion(401, "CREDENCIALES_INVALIDAS", "Credenciales invalidas");

export function aSesionUsuario(ctx: UsuarioConContexto): UsuarioSesionDto {
  return {
    id: ctx.usuario.id,
    nombre: ctx.usuario.nombre,
    email: ctx.usuario.email,
    organizacionId: ctx.usuario.organizacionId,
    rol: ctx.rol.codigo,
    permisos: ctx.rol.permisos
  };
}

// Login del sitio administrativo (KAN-112). firmarToken lo inyecta quien
// compone (apps/backend): application no conoce JWT.
export function loginAdmin(deps: {
  usuarioRepository: UsuarioRepository;
  firmarToken: (claims: TokenClaims) => string;
  ahora?: () => Date;
}) {
  const ahora = deps.ahora ?? (() => new Date());

  return async (input: LoginAdminDto): Promise<LoginAdminResultadoDto> => {
    const parsed = loginAdminSchema.safeParse(input);
    if (!parsed.success) {
      throw new ErrorAplicacion(400, "VALIDACION", "Email o clave con formato invalido");
    }
    const { email, clave } = parsed.data;

    const ctx = await deps.usuarioRepository.buscarPorEmail(email);
    const claveOk = await bcrypt.compare(clave, ctx?.usuario.hashClave ?? HASH_DUMMY);

    // Mensaje generico en todos los casos de rechazo: no revelar si el email existe.
    if (!ctx || !claveOk) throw credencialesInvalidas();
    if (ctx.usuario.estado !== "activo") throw credencialesInvalidas();
    if (ctx.organizacion.tipo !== "interna") throw credencialesInvalidas();

    // El 2FA se implementa mas adelante; por ahora se rechaza explicitamente.
    if (ctx.usuario.mfaEstado === "activo") {
      throw new ErrorAplicacion(403, "MFA_NO_IMPLEMENTADO", "El segundo factor de autenticacion aun no esta implementado");
    }

    await deps.usuarioRepository.registrarUltimoAcceso(ctx.usuario.id, ahora());

    const token = deps.firmarToken({
      sub: String(ctx.usuario.id),
      organizacionId: ctx.usuario.organizacionId,
      rol: ctx.rol.codigo
    });

    return { token, usuario: aSesionUsuario(ctx) };
  };
}
