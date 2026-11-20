import { eq } from "drizzle-orm";
import type { CuentaRepository, NuevaCuenta, ResultadoCrearCuenta } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

const ER_DUP_ENTRY = 1062;

// drizzle-orm >= 0.44 envuelve el error de mysql2 en DrizzleQueryError.cause.
function errorMysql(err: unknown): { errno?: number; message?: string } {
  const e = err as { errno?: number; message?: string; cause?: { errno?: number; message?: string } };
  return e.cause?.errno ? e.cause : e;
}

class Conflicto extends Error {
  constructor(readonly tipo: "email" | "rut" | "rol_inexistente") {
    super(tipo);
  }
}

// Implementacion Drizzle/MySQL del puerto CuentaRepository (KAN-144).
export class DrizzleCuentaRepository implements CuentaRepository {
  constructor(private readonly db: DbClient) {}

  async crear(c: NuevaCuenta): Promise<ResultadoCrearCuenta> {
    try {
      return await this.db.transaction(async (tx) => {
        const [r] = await tx.select({ id: rol.id }).from(rol).where(eq(rol.codigo, c.rolCodigo)).limit(1);
        if (!r) throw new Conflicto("rol_inexistente");
        // Chequeo previo para responder el conflicto correcto; el indice
        // unico cubre la carrera entre dos registros simultaneos (catch).
        const [ya] = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, c.usuario.email)).limit(1);
        if (ya) throw new Conflicto("email");
        const [orgYa] = await tx.select({ id: organizacion.id }).from(organizacion).where(eq(organizacion.rut, c.organizacion.rut)).limit(1);
        if (orgYa) throw new Conflicto("rut");

        const [{ id: organizacionId }] = await tx.insert(organizacion).values(c.organizacion).$returningId();
        const [{ id: usuarioId }] = await tx
          .insert(usuario)
          .values({ ...c.usuario, organizacionId, rolId: r.id })
          .$returningId();
        return { ok: true as const, usuarioId, organizacionId };
      });
    } catch (err) {
      if (err instanceof Conflicto) return { ok: false, conflicto: err.tipo };
      const e = errorMysql(err);
      if (e.errno === ER_DUP_ENTRY) {
        // El mensaje de MySQL nombra el indice: "... for key 'usuario.email'".
        return { ok: false, conflicto: /email/i.test(e.message ?? "") ? "email" : "rut" };
      }
      throw err;
    }
  }

  async actualizarClave(usuarioId: number, hashClave: string): Promise<void> {
    await this.db.update(usuario).set({ hashClave }).where(eq(usuario.id, usuarioId));
  }

  async guardarSecretoMfaPendiente(usuarioId: number, secretoCifrado: string): Promise<void> {
    await this.db.update(usuario).set({ mfaSecreto: secretoCifrado, mfaEstado: "pendiente" }).where(eq(usuario.id, usuarioId));
  }

  async activarMfa(usuarioId: number): Promise<void> {
    await this.db.update(usuario).set({ mfaEstado: "activo" }).where(eq(usuario.id, usuarioId));
  }
}
