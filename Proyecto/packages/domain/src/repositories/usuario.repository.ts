import type { Organizacion } from "../entities/organizacion.entity.js";
import type { Rol } from "../entities/rol.entity.js";
import type { Usuario } from "../entities/usuario.entity.js";

// Usuario junto con su rol y un resumen de su organizacion (lo minimo que
// necesita la autenticacion).
export interface UsuarioConContexto {
  usuario: Usuario;
  rol: Rol;
  organizacion: Pick<Organizacion, "id" | "tipo" | "estado">;
}

// Puerto de persistencia de usuarios. Implementacion en @cotizapp/infrastructure.
export interface UsuarioRepository {
  buscarPorEmail(email: string): Promise<UsuarioConContexto | null>;
  buscarPorId(id: number): Promise<UsuarioConContexto | null>;
  registrarUltimoAcceso(id: number, fecha: Date): Promise<void>;
}
