import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { DrizzleProveedorRepository } from "../src/repositories/proveedor.repository.js";
import { consultar } from "../src/db/client.js";
import { describeDb } from "./db.js";

const LOS_ANDES = 2;
const VALLE_CENTRAL = 3;
const EL_FOGON = 6;
const auditoria = (entidadId: number) => ({
  usuarioId: null, entidad: "organizacion", entidadId, accion: "editar" as const, datosAntes: {}, datosDespues: { operacion: "editar_perfil_proveedor", prueba: true }
});

describeDb("DrizzleProveedorRepository: perfil de empresa (KAN-108)", (db) => {
  const repo = () => new DrizzleProveedorRepository(db());

  it("perfil: datos de la organizacion, direccion, bodega, regiones y equipo; un cliente no tiene perfil", async () => {
    const p = await repo().perfil(LOS_ANDES);
    expect(p).toMatchObject({
      id: LOS_ANDES, razonSocial: "Distribuidora Los Andes Ltda.", rut: "76543210-3", nombreFantasia: "Los Andes Food Service",
      emailContacto: "ventas@losandes.test", plazoEstandarHoras: 24, plazoFueraRegionHoras: 72, horaCorte: "14:00", despachoGratisDesde: 150000,
      ofreceDespacho: true, ofreceRetiro: true, banco: "Banco de Chile", estado: "activa", comisionPct: 8,
      bodega: { id: 1, nombre: "Bodega Quilicura" },
      equipo: [{ nombre: "Ventas Los Andes", email: "ventas@losandes.test", telefono: null }]
    });
    expect(p!.direccion).toMatchObject({ comuna: expect.any(String), region: expect.any(String), comunaId: expect.any(Number) });
    expect(p!.regiones).toHaveLength(2); // region 05 y 13 en proveedor_cobertura
    expect(p!.creadaEn).toBeInstanceOf(Date);
    // Cambia con cada entrega (KAN-149): basta con que venga como numero.
    expect(typeof p!.entregasATiempoPct).toBe("number");
    expect((await repo().perfil(VALLE_CENTRAL))!.bodega).toBeNull();
    expect(await repo().perfil(EL_FOGON)).toBeNull();
  });

  it("actualizarPerfil: cambia la organizacion e inserta direcciones nuevas sin tocar la anterior", async () => {
    const [antes] = await consultar<{ direccionId: number; calle: string; puntoDir: number }>(
      db(),
      sql`SELECT o.direccion_id AS direccionId, d.calle, p.direccion_id AS puntoDir
          FROM organizacion o JOIN direccion d ON d.id = o.direccion_id JOIN punto_retiro p ON p.id = 1 WHERE o.id = ${LOS_ANDES}`
    );
    await repo().actualizarPerfil(
      LOS_ANDES,
      {
        telefono: "+56 2 2000 0000", horaCorte: "15:30", despachoGratisDesde: null, ofreceRetiro: true, cuentaBancaria: "11-222-33333-44",
        direccion: { calle: "Av. Irarrázaval", numero: "3400", complemento: null, comunaId: 20 },
        bodega: { nombre: "Bodega Ñuñoa", horario: "Lun a Sáb 08:00-14:00", calle: "Pedro de Valdivia", numero: "100", complemento: null, comunaId: 20 }
      },
      auditoria(LOS_ANDES)
    );
    const p = (await repo().perfil(LOS_ANDES))!;
    expect(p).toMatchObject({
      telefono: "+56 2 2000 0000", horaCorte: "15:30", despachoGratisDesde: null, cuentaBancaria: "11-222-33333-44",
      direccion: { calle: "Av. Irarrázaval", numero: "3400", comunaId: 20 },
      bodega: { id: 1, nombre: "Bodega Ñuñoa", horario: "Lun a Sáb 08:00-14:00", direccion: { calle: "Pedro de Valdivia", comunaId: 20 } }
    });
    const [despues] = await consultar<{ direccionId: number; viejaCalle: string; puntoDir: number; auditadas: number }>(
      db(),
      sql`SELECT o.direccion_id AS direccionId, (SELECT calle FROM direccion WHERE id = ${antes!.direccionId}) AS viejaCalle,
                 (SELECT direccion_id FROM punto_retiro WHERE id = 1) AS puntoDir,
                 (SELECT COUNT(*) FROM auditoria_log WHERE entidad = 'organizacion' AND entidad_id = ${LOS_ANDES}
                    AND JSON_UNQUOTE(JSON_EXTRACT(datos_despues, '$.operacion')) = 'editar_perfil_proveedor') AS auditadas
          FROM organizacion o WHERE o.id = ${LOS_ANDES}`
    );
    expect(despues!.direccionId).not.toBe(antes!.direccionId);
    expect(despues!.puntoDir).not.toBe(antes!.puntoDir);
    expect(despues!.viejaCalle).toBe(antes!.calle);
    expect(Number(despues!.auditadas)).toBe(1);
  });

  it("actualizarPerfil: sin punto de retiro, la bodega lo crea", async () => {
    await repo().actualizarPerfil(
      VALLE_CENTRAL,
      { ofreceRetiro: true, bodega: { nombre: "Bodega San Bernardo", horario: null, calle: "Av. Portales", numero: "55", complemento: null, comunaId: 20 } },
      auditoria(VALLE_CENTRAL)
    );
    const p = (await repo().perfil(VALLE_CENTRAL))!;
    expect(p.ofreceRetiro).toBe(true);
    expect(p.bodega).toMatchObject({ nombre: "Bodega San Bernardo", horario: null, direccion: { calle: "Av. Portales" } });
  });

  it("zonas (KAN-109): crear, editar y borrar solo las propias; la cobertura trae el id", async () => {
    const id = await repo().crearZona(LOS_ANDES, { comunaId: 20, regionCodigo: "13", costoDespacho: 3990, plazoHoras: 12 }, auditoria(LOS_ANDES));
    expect((await repo().cobertura(LOS_ANDES)).zonas).toContainEqual(expect.objectContaining({ id, comunaId: 20, comuna: "Ñuñoa", costoDespacho: 3990, plazoHoras: 12 }));
    expect(await repo().actualizarZona(LOS_ANDES, id, { costoDespacho: 2990, plazoHoras: null }, auditoria(LOS_ANDES))).toBe(true);
    expect((await repo().cobertura(LOS_ANDES)).zonas.find((z) => z.id === id)).toMatchObject({ costoDespacho: 2990, plazoHoras: null });
    // Otro proveedor no la toca.
    expect(await repo().actualizarZona(VALLE_CENTRAL, id, { costoDespacho: 1 }, auditoria(VALLE_CENTRAL))).toBe(false);
    expect(await repo().eliminarZona(VALLE_CENTRAL, id, auditoria(VALLE_CENTRAL))).toBe(false);
    expect(await repo().eliminarZona(LOS_ANDES, id, auditoria(LOS_ANDES))).toBe(true);
    expect((await repo().cobertura(LOS_ANDES)).zonas.some((z) => z.id === id)).toBe(false);
    const [aud] = await consultar<{ n: number }>(db(), sql`SELECT COUNT(*) AS n FROM auditoria_log WHERE entidad = 'organizacion' AND JSON_EXTRACT(datos_despues, '$.prueba') = true`);
    expect(Number(aud!.n)).toBe(3); // crear, editar y borrar (los rechazados no auditan)
  });

  it("puntos de retiro (KAN-109): lista con usado, crea, desactiva, cambia la direccion sin pisarla y borra solo sin envios", async () => {
    const antes = await repo().puntosRetiro(LOS_ANDES);
    expect(antes).toEqual([expect.objectContaining({ id: 1, nombre: "Bodega Quilicura", activo: true, usado: true, direccion: expect.objectContaining({ comuna: "Quilicura" }) })]);
    const id = await repo().crearPuntoRetiro(LOS_ANDES, { nombre: "Bodega Ñuñoa", horario: "L-S 8 a 14", activo: true, direccion: { calle: "Pedro de Valdivia", numero: "100", complemento: null, comunaId: 20 } }, auditoria(LOS_ANDES));
    expect((await repo().puntosRetiro(LOS_ANDES)).find((p) => p.id === id)).toMatchObject({ activo: true, usado: false, direccion: { calle: "Pedro de Valdivia", comuna: "Ñuñoa" } });

    const [{ dir }] = await consultar<{ dir: number }>(db(), sql`SELECT direccion_id AS dir FROM punto_retiro WHERE id = ${id}`);
    expect(await repo().actualizarPuntoRetiro(LOS_ANDES, id, { activo: false, direccion: { calle: "Irarrázaval", numero: "5", complemento: null, comunaId: 20 } }, auditoria(LOS_ANDES))).toBe(true);
    const cambiado = (await repo().puntosRetiro(LOS_ANDES)).find((p) => p.id === id)!;
    expect(cambiado).toMatchObject({ activo: false, direccion: { calle: "Irarrázaval" } });
    const [{ vieja }] = await consultar<{ vieja: string }>(db(), sql`SELECT calle AS vieja FROM direccion WHERE id = ${dir}`);
    expect(vieja).toBe("Pedro de Valdivia");
    // Los activos van primero.
    expect((await repo().puntosRetiro(LOS_ANDES)).map((p) => p.id)).toEqual([1, id]);

    expect(await repo().actualizarPuntoRetiro(VALLE_CENTRAL, id, { nombre: "X" }, auditoria(VALLE_CENTRAL))).toBe(false);
    expect(await repo().eliminarPuntoRetiro(VALLE_CENTRAL, id, auditoria(VALLE_CENTRAL))).toBe(false);
    expect(await repo().eliminarPuntoRetiro(LOS_ANDES, id, auditoria(LOS_ANDES))).toBe(true);
    expect((await repo().puntosRetiro(LOS_ANDES)).map((p) => p.id)).toEqual([1]);
  });

  it("crearDocumento (KAN-110): queda pendiente de revision, con su vigencia y auditoria; listarDocumentos lo trae", async () => {
    const d = await repo().crearDocumento(
      LOS_ANDES,
      { tipo: "vigencia", url: "http://localhost/uploads/proveedores/2/documentos/vigencia-x.pdf", venceEn: "2026-12-10", vigencia: "por_vencer" },
      { usuarioId: null, entidad: "proveedor_documento", entidadId: LOS_ANDES, accion: "crear", datosAntes: null, datosDespues: { operacion: "subir_documento", prueba: true } }
    );
    expect(d).toMatchObject({ proveedorId: LOS_ANDES, tipo: "vigencia", venceEn: "2026-12-10", vigencia: "por_vencer", revisionEstado: "pendiente", revisadoPor: null });
    expect((await repo().listarDocumentos(LOS_ANDES)).at(-1)).toMatchObject({ id: d.id, tipo: "vigencia" });
    const [a] = await consultar<{ n: number }>(db(), sql`SELECT COUNT(*) AS n FROM auditoria_log WHERE entidad = 'proveedor_documento' AND entidad_id = ${d.id}`);
    expect(Number(a!.n)).toBe(1);
  });

});
