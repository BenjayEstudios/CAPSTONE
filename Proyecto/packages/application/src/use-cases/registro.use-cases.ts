import bcrypt from "bcryptjs";
import {
  registroCompradorSchema,
  registroProveedorSchema,
  type CuentaRepository,
  type LoginResultadoDto,
  type NuevaCuenta,
  type RegistroCompradorDto,
  type RegistroProveedorDto,
  type RegistroProveedorResultadoDto,
  type TokenClaims,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { aSesionConOrganizacion } from "./login.use-case.js";

const COSTO_BCRYPT = 10;

async function crearCuenta(repo: CuentaRepository, cuenta: NuevaCuenta) {
  const r = await repo.crear(cuenta);
  if (r.ok) return r;
  if (r.conflicto === "email") throw new ErrorAplicacion(409, "EMAIL_EN_USO", "Ya existe una cuenta con ese correo");
  if (r.conflicto === "rut") throw new ErrorAplicacion(409, "RUT_EN_USO", "Ya existe una organizacion con ese RUT");
  // Seed incompleto: el rol de sistema no existe en la base.
  throw new ErrorAplicacion(500, "ROL_INEXISTENTE", `Falta el rol "${cuenta.rolCodigo}" en la base`);
}

// POST /auth/registro/comprador (KAN-97 / KAN-144). Crea organizacion tipo
// cliente (activa) + usuario comprador (activo) y deja la sesion iniciada.
// Persona: la organizacion lleva su nombre y su RUT. Empresa: los datos de
// "empresa".
export function registrarComprador(deps: {
  cuentaRepository: CuentaRepository;
  usuarioRepository: UsuarioRepository;
  firmarToken: (claims: TokenClaims) => string;
  ahora?: () => Date;
}) {
  const ahora = deps.ahora ?? (() => new Date());
  return async (input: RegistroCompradorDto): Promise<LoginResultadoDto> => {
    const d = validar(registroCompradorSchema, input);
    const hashClave = await bcrypt.hash(d.clave, COSTO_BCRYPT);
    const org = d.empresa
      ? {
          razonSocial: d.empresa.razonSocial,
          rut: d.empresa.rut,
          nombreFantasia: d.empresa.nombreFantasia ?? null,
          giro: d.empresa.giro ?? null,
          telefono: d.empresa.telefono ?? d.telefono ?? null
        }
      : { razonSocial: d.nombre, rut: d.rut, nombreFantasia: null, giro: null, telefono: d.telefono ?? null };

    const { usuarioId } = await crearCuenta(deps.cuentaRepository, {
      organizacion: { tipo: "cliente", ...org, emailContacto: d.email, estado: "activa" },
      usuario: { nombre: d.nombre, email: d.email, rut: d.rut, telefono: d.telefono ?? null, hashClave, estado: "activo" },
      rolCodigo: "comprador"
    });

    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx) throw new ErrorAplicacion(500, "REGISTRO_INCONSISTENTE", "No se pudo leer la cuenta recien creada");
    await deps.usuarioRepository.registrarUltimoAcceso(usuarioId, ahora());
    const token = deps.firmarToken({ sub: String(usuarioId), organizacionId: ctx.usuario.organizacionId, rol: ctx.rol.codigo });
    return { token, usuario: aSesionConOrganizacion(ctx) };
  };
}

// POST /auth/registro/proveedor (KAN-100 / KAN-144). Crea organizacion tipo
// proveedor en_revision + usuario proveedor. No inicia sesion: el login
// responde USUARIO_NO_ACTIVO hasta que un administrador apruebe la
// organizacion (POST /proveedores/:id/aprobar).
export function registrarProveedor(deps: { cuentaRepository: CuentaRepository }) {
  return async (input: RegistroProveedorDto): Promise<RegistroProveedorResultadoDto> => {
    const d = validar(registroProveedorSchema, input);
    const hashClave = await bcrypt.hash(d.clave, COSTO_BCRYPT);
    const { organizacionId } = await crearCuenta(deps.cuentaRepository, {
      organizacion: {
        tipo: "proveedor",
        razonSocial: d.empresa.razonSocial,
        rut: d.empresa.rut,
        nombreFantasia: d.empresa.nombreFantasia ?? null,
        giro: d.empresa.giro ?? null,
        emailContacto: d.email,
        telefono: d.empresa.telefono ?? d.telefono ?? null,
        estado: "en_revision"
      },
      usuario: { nombre: d.nombre, email: d.email, rut: d.rut ?? null, telefono: d.telefono ?? null, hashClave, estado: "activo" },
      rolCodigo: "proveedor"
    });
    return {
      organizacionId,
      estado: "en_revision",
      mensaje: "Recibimos tu solicitud. Te avisaremos por correo cuando tu cuenta sea aprobada."
    };
  };
}
