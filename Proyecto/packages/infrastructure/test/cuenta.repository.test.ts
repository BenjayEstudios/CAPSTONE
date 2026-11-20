import { afterEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { NuevaCuenta } from "@cotizapp/domain";
import { DrizzleCuentaRepository } from "../src/repositories/cuenta.repository.js";
import { DrizzleUsuarioRepository } from "../src/repositories/usuario.repository.js";
import { DrizzleUsuarioAdminRepository } from "../src/repositories/usuario-admin.repository.js";
import { consultar } from "../src/db/client.js";
import { describeDb } from "./db.js";

// DrizzleCuentaRepository abre su propia transaccion, y en MySQL un BEGIN
// confirma la transaccion externa de describeDb: el ROLLBACK de db.ts no
// alcanza. Por eso estos tests borran lo que crean (email/RUT exclusivos).
const EMAIL = "kan144-test@cotizapp.test";
const RUT = "33333333-3";

const cuenta = (over: Partial<NuevaCuenta["usuario"]> = {}, rut = RUT): NuevaCuenta => ({
  organizacion: {
    tipo: "cliente", razonSocial: "Test KAN-144", rut, nombreFantasia: "Fantasia KAN-144", giro: null,
    emailContacto: EMAIL, telefono: null, estado: "activa"
  },
  usuario: { nombre: "Test", email: EMAIL, rut: null, telefono: null, hashClave: "x".repeat(60), estado: "activo", ...over },
  rolCodigo: "comprador"
});

describeDb("DrizzleCuentaRepository", (db) => {
  afterEach(async () => {
    await db().execute(sql`ROLLBACK`);
    await db().execute(sql`DELETE FROM usuario WHERE email LIKE 'kan144-%'`);
    await db().execute(sql`DELETE FROM organizacion WHERE rut IN (${RUT}, '44444444-4')`);
  });

  it("crea organizacion + usuario con el rol pedido y el contexto trae el nombre de la organizacion", async () => {
    const r = await new DrizzleCuentaRepository(db()).crear(cuenta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ctx = await new DrizzleUsuarioRepository(db()).buscarPorId(r.usuarioId);
    expect(ctx).toMatchObject({
      usuario: { email: EMAIL, organizacionId: r.organizacionId, estado: "activo" },
      rol: { codigo: "comprador" },
      organizacion: { id: r.organizacionId, tipo: "cliente", estado: "activa", nombre: "Fantasia KAN-144" }
    });
  });

  it("email o RUT repetido -> conflicto, sin dejar filas a medias", async () => {
    const repo = new DrizzleCuentaRepository(db());
    expect((await repo.crear(cuenta())).ok).toBe(true);
    expect(await repo.crear(cuenta({}, "44444444-4"))).toEqual({ ok: false, conflicto: "email" });
    expect(await repo.crear(cuenta({ email: "kan144-otro@cotizapp.test" }))).toEqual({ ok: false, conflicto: "rut" });
    const [n] = await consultar<{ n: number }>(db(), sql`SELECT COUNT(*) AS n FROM organizacion WHERE rut = '44444444-4'`);
    expect(Number(n!.n)).toBe(0);
  });

  it("rol inexistente -> conflicto rol_inexistente", async () => {
    expect(await new DrizzleCuentaRepository(db()).crear({ ...cuenta(), rolCodigo: "no-existe" })).toEqual({ ok: false, conflicto: "rol_inexistente" });
  });

  it("guarda el secreto pendiente, lo activa, y un admin que pasa el 2FA a pendiente lo borra", async () => {
    const repo = new DrizzleCuentaRepository(db());
    const r = await repo.crear(cuenta());
    if (!r.ok) throw new Error("no se creo");
    const usuarios = new DrizzleUsuarioRepository(db());
    await repo.guardarSecretoMfaPendiente(r.usuarioId, "v1:cifrado");
    expect((await usuarios.buscarPorId(r.usuarioId))?.usuario).toMatchObject({ mfaEstado: "pendiente", mfaSecreto: "v1:cifrado" });
    await repo.activarMfa(r.usuarioId);
    expect((await usuarios.buscarPorId(r.usuarioId))?.usuario).toMatchObject({ mfaEstado: "activo", mfaSecreto: "v1:cifrado" });

    const auditoria = { usuarioId: null, entidad: "usuario", entidadId: r.usuarioId, accion: "editar" as const, datosAntes: null, datosDespues: null };
    await new DrizzleUsuarioAdminRepository(db()).actualizar(r.usuarioId, { nombre: "Otro" }, auditoria);
    expect((await usuarios.buscarPorId(r.usuarioId))?.usuario.mfaSecreto).toBe("v1:cifrado");
    await new DrizzleUsuarioAdminRepository(db()).actualizar(r.usuarioId, { mfaEstado: "pendiente" }, auditoria);
    expect((await usuarios.buscarPorId(r.usuarioId))?.usuario).toMatchObject({ mfaEstado: "pendiente", mfaSecreto: null });
    await db().execute(sql`DELETE FROM auditoria_log WHERE entidad = 'usuario' AND entidad_id = ${r.usuarioId}`);
  });

  it("actualizarClave cambia hash_clave", async () => {
    const repo = new DrizzleCuentaRepository(db());
    const r = await repo.crear(cuenta());
    if (!r.ok) throw new Error("no se creo");
    await repo.actualizarClave(r.usuarioId, "y".repeat(60));
    const ctx = await new DrizzleUsuarioRepository(db()).buscarPorId(r.usuarioId);
    expect(ctx?.usuario.hashClave).toBe("y".repeat(60));
  });
});
