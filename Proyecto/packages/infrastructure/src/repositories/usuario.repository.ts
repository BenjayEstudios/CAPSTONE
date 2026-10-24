import { eq } from "drizzle-orm";
import type { PermisosRol, Rol, Usuario, UsuarioConContexto, UsuarioRepository } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

type Fila = {
  usuario: typeof usuario.$inferSelect;
  rol: typeof rol.$inferSelect;
  organizacion: Pick<typeof organizacion.$inferSelect, "id" | "tipo" | "estado">;
};

function toContexto(f: Fila): UsuarioConContexto {
  const u: Usuario = { ...f.usuario };
  const r: Rol = {
    id: f.rol.id,
    codigo: f.rol.codigo,
    nombre: f.rol.nombre,
    descripcion: f.rol.descripcion,
    esSistema: f.rol.esSistema === 1,
    permisos: f.rol.permisos as PermisosRol,
    permisosActualizadoPor: f.rol.permisosActualizadoPor,
    permisosActualizadoEn: f.rol.permisosActualizadoEn
  };
  return { usuario: u, rol: r, organizacion: f.organizacion };
}

// Implementacion Drizzle/MySQL del puerto UsuarioRepository.
export class DrizzleUsuarioRepository implements UsuarioRepository {
  constructor(private readonly db: DbClient) {}

  private consulta() {
    return this.db
      .select({
        usuario,
        rol,
        organizacion: { id: organizacion.id, tipo: organizacion.tipo, estado: organizacion.estado }
      })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .innerJoin(organizacion, eq(usuario.organizacionId, organizacion.id));
  }

  async buscarPorEmail(email: string): Promise<UsuarioConContexto | null> {
    const [fila] = await this.consulta().where(eq(usuario.email, email)).limit(1);
    return fila ? toContexto(fila) : null;
  }

  async buscarPorId(id: number): Promise<UsuarioConContexto | null> {
    const [fila] = await this.consulta().where(eq(usuario.id, id)).limit(1);
    return fila ? toContexto(fila) : null;
  }

  async registrarUltimoAcceso(id: number, fecha: Date): Promise<void> {
    await this.db.update(usuario).set({ ultimoAcceso: fecha }).where(eq(usuario.id, id));
  }
}
