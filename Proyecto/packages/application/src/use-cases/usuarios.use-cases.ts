import bcrypt from "bcryptjs";
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  listarUsuariosQuerySchema,
  type RegistroAuditoria,
  type ServicioCorreo,
  type UsuarioAdmin,
  type UsuarioAdminRepository,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { plantillaInvitacionUsuario } from "./correos.js";

const PERMISO_ADMIN = "cambiar_permisos";
const RONDAS_BCRYPT = 10;

// Datos auditables: nunca incluyen clave ni hash.
const snapshot = (u: UsuarioAdmin): Record<string, unknown> => ({
  nombre: u.nombre,
  email: u.email,
  rolId: u.rol.id,
  organizacionId: u.organizacion.id,
  telefono: u.telefono,
  mfaEstado: u.mfaEstado,
  estado: u.estado
});

const noEncontrado = () => new ErrorAplicacion(404, "USUARIO_NO_ENCONTRADO", "El usuario no existe");

type DepsAdmin = { usuarioAdminRepository: UsuarioAdminRepository; usuarioRepository: UsuarioRepository };

export function listarUsuarios(deps: { usuarioAdminRepository: UsuarioAdminRepository }) {
  return async (input: unknown) => {
    const f = validar(listarUsuariosQuerySchema, input);
    const { items, total } = await deps.usuarioAdminRepository.listar(f);
    return { items, pagina: f.pagina, tamano: f.tamano, total, totalPaginas: Math.max(1, Math.ceil(total / f.tamano)) };
  };
}

export function obtenerUsuario(deps: { usuarioAdminRepository: UsuarioAdminRepository }) {
  return async (id: number) => {
    const u = await deps.usuarioAdminRepository.obtener(id);
    if (!u) throw noEncontrado();
    return u;
  };
}

export function opcionesUsuarios(deps: { usuarioAdminRepository: UsuarioAdminRepository }) {
  return () => deps.usuarioAdminRepository.opciones();
}

/** Bloquea si `id` es hoy un administrador activo (cambiar_permisos total) y el ultimo que queda. */
async function exigirNoSerUltimoAdmin(deps: DepsAdmin, id: number) {
  const ctx = await deps.usuarioRepository.buscarPorId(id);
  const esAdmin = !!ctx && ctx.usuario.estado === "activo" && ctx.rol.permisos[PERMISO_ADMIN] === "total";
  if (esAdmin && (await deps.usuarioAdminRepository.contarActivosConPermisoTotal(PERMISO_ADMIN)) <= 1) {
    throw new ErrorAplicacion(409, "ULTIMO_ADMIN", "No se puede dejar al sistema sin un administrador activo");
  }
}

export function crearUsuario(
  deps: DepsAdmin & { servicioCorreo: ServicioCorreo; generarClave: () => string; urlPanel: string }
) {
  return async (input: unknown, actorId: number) => {
    const d = validar(crearUsuarioSchema, input);
    if (await deps.usuarioRepository.buscarPorEmail(d.email)) {
      throw new ErrorAplicacion(409, "EMAIL_DUPLICADO", "Ya existe un usuario con ese email");
    }
    if (!(await deps.usuarioAdminRepository.existeRol(d.rolId))) throw new ErrorAplicacion(400, "ROL_INVALIDO", "El rol no existe");
    if (!(await deps.usuarioAdminRepository.existeOrganizacion(d.organizacionId))) {
      throw new ErrorAplicacion(400, "ORGANIZACION_INVALIDA", "La organizacion no existe");
    }

    const clave = deps.generarClave();
    const hashClave = await bcrypt.hash(clave, RONDAS_BCRYPT);
    // mfa "activo" = 2FA exigido pero aun sin configurar -> "pendiente" (el login rechaza "activo" hasta implementar 2FA).
    const mfaEstado = d.mfa === "activo" ? "pendiente" : d.mfa === "opcional" ? "opcional" : "inactivo";

    const id = await deps.usuarioAdminRepository.crear(
      {
        organizacionId: d.organizacionId,
        rolId: d.rolId,
        nombre: d.nombre,
        email: d.email,
        rut: d.rut ?? null,
        telefono: d.telefono ?? null,
        hashClave,
        mfaEstado
      },
      (nuevoId): RegistroAuditoria => ({
        usuarioId: actorId,
        entidad: "usuario",
        entidadId: nuevoId,
        accion: "crear",
        datosAntes: null,
        datosDespues: {
          nombre: d.nombre,
          email: d.email,
          rolId: d.rolId,
          organizacionId: d.organizacionId,
          mfaEstado,
          estado: "invitado",
          modo: d.modo
        }
      })
    );
    const usuario = (await deps.usuarioAdminRepository.obtener(id)) as UsuarioAdmin;

    // La clave se devuelve UNA sola vez (modo clave_temporal) o se envia por correo (invitacion); nunca ambas.
    if (d.modo === "clave_temporal") return { usuario, claveTemporal: clave };

    let correoEnviado = true;
    try {
      await deps.servicioCorreo.enviar(
        plantillaInvitacionUsuario({ para: d.email, nombre: d.nombre, claveTemporal: clave, urlPanel: deps.urlPanel })
      );
    } catch {
      correoEnviado = false;
    }
    return { usuario, correoEnviado };
  };
}

export function actualizarUsuario(deps: DepsAdmin) {
  return async (id: number, input: unknown, actorId: number) => {
    const antes = await deps.usuarioAdminRepository.obtener(id);
    if (!antes) throw noEncontrado();
    const c = validar(actualizarUsuarioSchema, input);

    const cambiaRol = c.rolId !== undefined && c.rolId !== antes.rol.id;
    const cambiaOrg = c.organizacionId !== undefined && c.organizacionId !== antes.organizacion.id;
    if (id === actorId) {
      if (cambiaRol || cambiaOrg) throw new ErrorAplicacion(409, "BLOQUEO_AUTOEDICION", "No puedes cambiar tu propio rol u organizacion");
      if (c.mfaEstado === "activo") {
        throw new ErrorAplicacion(409, "BLOQUEO_AUTOEDICION", "No puedes activarte el 2FA obligatorio: quedarias sin acceso");
      }
    }
    if (cambiaRol && !(await deps.usuarioAdminRepository.existeRol(c.rolId as number))) {
      throw new ErrorAplicacion(400, "ROL_INVALIDO", "El rol no existe");
    }
    if (cambiaOrg && !(await deps.usuarioAdminRepository.existeOrganizacion(c.organizacionId as number))) {
      throw new ErrorAplicacion(400, "ORGANIZACION_INVALIDA", "La organizacion no existe");
    }
    if (cambiaRol || cambiaOrg) await exigirNoSerUltimoAdmin(deps, id);

    const antesSnap = snapshot(antes);
    const despues: Record<string, unknown> = { ...antesSnap };
    for (const k of ["nombre", "rolId", "organizacionId", "telefono", "mfaEstado"] as const) {
      if (c[k] !== undefined) despues[k] = c[k];
    }
    const claves = Object.keys(despues).filter((k) => antesSnap[k] !== despues[k]);
    if (claves.length > 0) {
      await deps.usuarioAdminRepository.actualizar(id, c, {
        usuarioId: actorId,
        entidad: "usuario",
        entidadId: id,
        accion: "editar",
        datosAntes: Object.fromEntries(claves.map((k) => [k, antesSnap[k]])),
        datosDespues: Object.fromEntries(claves.map((k) => [k, despues[k]]))
      });
    }
    return (await deps.usuarioAdminRepository.obtener(id)) as UsuarioAdmin;
  };
}

export function suspenderUsuario(deps: DepsAdmin) {
  return async (id: number, actorId: number) => {
    const antes = await deps.usuarioAdminRepository.obtener(id);
    if (!antes) throw noEncontrado();
    if (id === actorId) throw new ErrorAplicacion(409, "BLOQUEO_AUTOSUSPENSION", "No puedes suspenderte a ti mismo");
    if (antes.estado === "suspendido") throw new ErrorAplicacion(409, "ESTADO_INVALIDO", "El usuario ya esta suspendido");
    await exigirNoSerUltimoAdmin(deps, id);
    await deps.usuarioAdminRepository.cambiarEstado(id, "suspendido", {
      usuarioId: actorId,
      entidad: "usuario",
      entidadId: id,
      accion: "suspender",
      datosAntes: { estado: antes.estado },
      datosDespues: { estado: "suspendido" }
    });
    return (await deps.usuarioAdminRepository.obtener(id)) as UsuarioAdmin;
  };
}

export function reactivarUsuario(deps: { usuarioAdminRepository: UsuarioAdminRepository }) {
  return async (id: number, actorId: number) => {
    const antes = await deps.usuarioAdminRepository.obtener(id);
    if (!antes) throw noEncontrado();
    if (antes.estado !== "suspendido") throw new ErrorAplicacion(409, "ESTADO_INVALIDO", "El usuario no esta suspendido");
    // Quien nunca ingreso vuelve a "invitado" (su clave temporal sigue vigente).
    const estado = antes.ultimoAcceso ? "activo" : "invitado";
    await deps.usuarioAdminRepository.cambiarEstado(id, estado, {
      usuarioId: actorId,
      entidad: "usuario",
      entidadId: id,
      accion: "editar",
      datosAntes: { estado: "suspendido" },
      datosDespues: { estado }
    });
    return (await deps.usuarioAdminRepository.obtener(id)) as UsuarioAdmin;
  };
}
