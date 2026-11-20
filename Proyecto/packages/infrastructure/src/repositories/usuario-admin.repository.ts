import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type {
  BuscarOrganizacionesQueryDto,
  CambiosUsuario,
  ListarUsuariosQueryDto,
  ListadoUsuarios,
  NuevoUsuario,
  OpcionesUsuario,
  OrganizacionOpcion,
  RegistroAuditoria,
  UsuarioAdmin,
  UsuarioAdminRepository,
  UsuarioEstado,
  UsuarioOrden
} from "@cotizapp/domain";
import { TOPE_CONTEO } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";
import { escaparLike, pareceRut, planBusqueda } from "./busqueda-texto.js";

// Todos los ordenes salen de un indice (PK o usuario_nombre_idx) y desempatan por id.
const ORDENES: Record<UsuarioOrden, SQL[]> = {
  reciente: [desc(usuario.id)],
  antiguo: [asc(usuario.id)],
  nombre_asc: [asc(usuario.nombre), asc(usuario.id)],
  nombre_desc: [desc(usuario.nombre), desc(usuario.id)]
};

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

  async listar(f: ListarUsuariosQueryDto): Promise<ListadoUsuarios> {
    const cond: SQL[] = [];
    if (f.rolId) cond.push(eq(usuario.rolId, f.rolId));
    if (f.organizacionId) cond.push(eq(usuario.organizacionId, f.organizacionId));
    if (f.estado) cond.push(eq(usuario.estado, f.estado));
    if (f.q) {
      const plan = planBusqueda(f.q);
      if (plan.modo === "fulltext") {
        cond.push(sql`MATCH(${usuario.nombre}, ${usuario.email}) AGAINST (${plan.expresion} IN BOOLEAN MODE)`);
      } else {
        const b = or(like(usuario.nombre, plan.patron), like(usuario.email, plan.patron));
        if (b) cond.push(b);
      }
    }
    const where = cond.length ? and(...cond) : undefined;

    // Pagina: se lee una fila de mas para saber si hay siguiente sin depender del conteo.
    // Conteo: acotado a TOPE_CONTEO + 1 filas, asi su costo no crece con la tabla.
    const acotado = this.db.select({ id: usuario.id }).from(usuario).where(where).limit(TOPE_CONTEO + 1).as("acotado");
    const [filas, [conteo]] = await Promise.all([
      this.base().where(where).orderBy(...ORDENES[f.orden]).limit(f.tamano + 1).offset((f.pagina - 1) * f.tamano),
      this.db.select({ n: count() }).from(acotado)
    ]);
    const n = Number(conteo?.n ?? 0);
    return {
      items: filas.slice(0, f.tamano).map(aUsuarioAdmin),
      total: Math.min(n, TOPE_CONTEO),
      totalExacto: n <= TOPE_CONTEO,
      hayMas: filas.length > f.tamano
    };
  }

  async obtener(id: number) {
    const [f] = await this.base().where(eq(usuario.id, id)).limit(1);
    return f ? aUsuarioAdmin(f) : null;
  }

  async opciones(): Promise<OpcionesUsuario> {
    const roles = await this.db.select({ id: rol.id, codigo: rol.codigo, nombre: rol.nombre }).from(rol).orderBy(rol.id);
    return { roles };
  }

  // Typeahead de organizaciones: por id exacto (para mostrar la ya elegida), por RUT (prefijo
  // sobre el indice unico) o por nombre (FULLTEXT / prefijo). Siempre acotado por `limite`.
  async buscarOrganizaciones(f: BuscarOrganizacionesQueryDto): Promise<OrganizacionOpcion[]> {
    let where: SQL | undefined;
    if (f.id) {
      where = eq(organizacion.id, f.id);
    } else if (f.q && pareceRut(f.q)) {
      where = like(organizacion.rut, `${escaparLike(f.q.trim())}%`);
    } else if (f.q) {
      const plan = planBusqueda(f.q);
      where =
        plan.modo === "fulltext"
          ? sql`MATCH(${organizacion.razonSocial}, ${organizacion.nombreFantasia}) AGAINST (${plan.expresion} IN BOOLEAN MODE)`
          : like(organizacion.razonSocial, plan.patron);
    }
    return this.db
      .select({
        id: organizacion.id,
        razonSocial: organizacion.razonSocial,
        rut: organizacion.rut,
        tipo: organizacion.tipo,
        estado: organizacion.estado
      })
      .from(organizacion)
      .where(where)
      .orderBy(organizacion.razonSocial, organizacion.id)
      .limit(f.limite);
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
