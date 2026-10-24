import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type {
  CambiosUsuario,
  ListarUsuariosQueryDto,
  NuevoUsuario,
  OpcionesUsuario,
  RegistroAuditoria,
  UsuarioAdmin,
  UsuarioAdminRepository,
  UsuarioEstado
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

const escaparLike = (s: string) => s.replace(/[\%_]/g, (c) => `\${c}`);

// Seleccion explicita: hash_clave NUNCA se lee en este repositorio.
const seleccion = {
  id: usuario.id,
  nombre: usuario.nombre,
  email: usuario.email,
  rut: usuario.rut,
  telefono: usuario.telefono,
  ultimoAcceso: usuario.ultimoAcceso,
  mfaEstado: usuario.mfaEstado,
  estado: usuario.estado,
  rolId: rol.id,
  rolCodigo: rol.codigo,
  rolNombre: rol.nombre,
  orgId: organizacion.id,
  orgRazonSocial: organizacion.razonSocial,
  orgTipo: organizacion.tipo
};

function aUsuarioAdmin(f: {
  id: number; nombre: string; email: string; rut: string | null; telefono: string | null;
  ultimoAcceso: Date | null; mfaEstado: UsuarioAdmin["mfaEstado"]; estado: UsuarioAdmin["estado"];
  rolId: number; rolCodigo: string; rolNombre: string; orgId: number; orgRazonSocial: string; orgTipo: UsuarioAdmin["organizacion"]["tipo"];
}): UsuarioAdmin {
  return {
    id: f.id, nombre: f.nombre, email: f.email, rut: f.rut, telefono: f.telefono,
    ultimoAcceso: f.ultimoAcceso, mfaEstado: f.mfaEstado, estado: f.estado,
    rol: { id: f.rolId, codigo: f.rolCodigo, nombre: f.rolNombre },
    organizacion: { id: f.orgId, razonSocial: f.orgRazonSocial, tipo: f.orgTipo }
  };
}

// Implementacion Drizzle/MySQL del puerto UsuarioAdminRepository.
export class DrizzleUsuarioAdminRepository implements UsuarioAdminRepository {
  constructor(private readonly db: DbClient) {}

  private base() {
    return this.db
      .select(seleccion)
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .innerJoin(organizacion, eq(usuario.organizacionId, organizacion.id));
  }

  async listar(f: ListarUsuariosQueryDto) {
    const cond: SQL[] = [];
    if (f.rolId) cond.push(eq(usuario.rolId, f.rolId));
    if (f.organizacionId) cond.push(eq(usuario.organizacionId, f.organizacionId));
    if (f.estado) cond.push(eq(usuario.estado, f.estado));
    if (f.q) {
      const p = `%${escaparLike(f.q)}%`;
      const b = or(like(usuario.nombre, p), like(usuario.email, p));
      if (b) cond.push(b);
    }
    const where = cond.length ? and(...cond) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(usuario).where(where);
    const filas = await this.base().where(where).orderBy(desc(usuario.id)).limit(f.tamano).offset((f.pagina - 1) * f.tamano);
    return { items: filas.map(aUsuarioAdmin), total };
  }

  async obtener(id: number) {
    const [f] = await this.base().where(eq(usuario.id, id)).limit(1);
    return f ? aUsuarioAdmin(f) : null;
  }

  async opciones(): Promise<OpcionesUsuario> {
    const roles = await this.db.select({ id: rol.id, codigo: rol.codigo, nombre: rol.nombre }).from(rol).orderBy(rol.id);
    const organizaciones = await this.db
      .select({ id: organizacion.id, razonSocial: organizacion.razonSocial, tipo: organizacion.tipo, estado: organizacion.estado })
      .from(organizacion)
      .orderBy(organizacion.tipo, organizacion.razonSocial)
      .limit(1000);
    return { roles, organizaciones };
  }

  async existeRol(id: number) {
    const [f] = await this.db.select({ id: rol.id }).from(rol).where(eq(rol.id, id)).limit(1);
    return !!f;
  }

  async existeOrganizacion(id: number) {
    const [f] = await this.db.select({ id: organizacion.id }).from(organizacion).where(eq(organizacion.id, id)).limit(1);
    return !!f;
  }

  async contarActivosConPermisoTotal(codigo: string) {
    const [r] = await this.db
      .select({ n: count() })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(and(eq(usuario.estado, "activo"), sql`JSON_UNQUOTE(JSON_EXTRACT(${rol.permisos}, ${`$.${codigo}`})) = 'total'`));
    return Number(r?.n ?? 0);
  }

  async crear(datos: NuevoUsuario, auditoria: (id: number) => RegistroAuditoria) {
    return this.db.transaction(async (tx) => {
      const [res] = await tx.insert(usuario).values({ ...datos, estado: "invitado" });
      const id = Number(res.insertId);
      await tx.insert(auditoriaLog).values(auditoria(id));
      return id;
    });
  }

  async actualizar(id: number, cambios: CambiosUsuario, auditoria: RegistroAuditoria) {
    await this.db.transaction(async (tx) => {
      await tx.update(usuario).set(cambios).where(eq(usuario.id, id));
      await tx.insert(auditoriaLog).values(auditoria);
    });
  }

  async cambiarEstado(id: number, estado: UsuarioEstado, auditoria: RegistroAuditoria) {
    await this.db.transaction(async (tx) => {
      await tx.update(usuario).set({ estado }).where(eq(usuario.id, id));
      await tx.insert(auditoriaLog).values(auditoria);
    });
  }
}
