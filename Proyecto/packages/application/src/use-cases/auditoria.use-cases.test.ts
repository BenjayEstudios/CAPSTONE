import { describe, expect, it } from "vitest";
import type { AuditoriaRepository, FiltrosAuditoria, RegistroAuditoriaLog } from "@cotizapp/domain";
import { enmascararSensibles, listarAuditoria, obtenerFiltrosAuditoria, obtenerRegistroAuditoria } from "./auditoria.use-cases.js";

const reg = (id: number, p: Partial<RegistroAuditoriaLog> = {}): RegistroAuditoriaLog => ({
  id, accion: "editar", entidad: "producto", entidadId: id, usuario: { id: 1, nombre: "Ana" },
  creadoEn: new Date("2026-03-10T12:00:00Z"), datosAntes: null, datosDespues: null, ...p
});

function repoEnMemoria(datos: RegistroAuditoriaLog[]): AuditoriaRepository {
  return {
    listar: async (f: FiltrosAuditoria) => {
      const ok = datos
        .filter((r) => !f.entidad || r.entidad === f.entidad)
        .filter((r) => !f.accion || r.accion === f.accion)
        .filter((r) => !f.usuarioId || r.usuario?.id === f.usuarioId)
        .filter((r) => !f.desde || r.creadoEn >= f.desde)
        .filter((r) => !f.hastaExclusivo || r.creadoEn < f.hastaExclusivo)
        .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime() || b.id - a.id);
      return { items: ok.slice((f.pagina - 1) * f.tamano, f.pagina * f.tamano), total: ok.length };
    },
    buscarPorId: async (id) => datos.find((r) => r.id === id) ?? null,
    entidadesDistintas: async () => [...new Set(datos.map((r) => r.entidad))].sort(),
    usuariosEnLog: async () => [...new Map(datos.flatMap((r) => (r.usuario ? [[r.usuario.id, r.usuario] as const] : []))).values()]
  };
}

const datos = [
  reg(1, { creadoEn: new Date("2026-03-01T00:00:00Z") }),
  reg(2, { entidad: "proveedor", accion: "aprobar", usuario: { id: 2, nombre: "Beto" }, creadoEn: new Date("2026-03-05T23:59:59Z"), datosDespues: { operacion: "aprobar_proveedor" } }),
  reg(3, { entidad: "proveedor", accion: "suspender", usuario: null, creadoEn: new Date("2026-03-06T00:00:00Z") }),
  reg(4, { creadoEn: new Date("2026-03-10T08:00:00Z") })
];
const listar = (q: unknown) => listarAuditoria({ auditoriaRepository: repoEnMemoria(datos) })(q);
const ids = (r: { items: Array<{ id: number }> }) => r.items.map((i) => i.id);

describe("listarAuditoria", () => {
  it("ordena por fecha descendente y pagina", async () => {
    const r = await listar({ tamano: 3 });
    expect(ids(r)).toEqual([4, 3, 2]);
    expect(r).toMatchObject({ total: 4, pagina: 1, tamano: 3, totalPaginas: 2 });
    expect(ids(await listar({ tamano: 3, pagina: 2 }))).toEqual([1]);
  });
  it("filtra por entidad, accion y usuario", async () => {
    expect(ids(await listar({ entidad: "proveedor" }))).toEqual([3, 2]);
    expect(ids(await listar({ accion: "aprobar" }))).toEqual([2]);
    expect(ids(await listar({ usuarioId: "2" }))).toEqual([2]);
    expect((await listar({ entidad: "", accion: "" })).total).toBe(4);
  });
  it("rango de fechas inclusivo en ambos extremos", async () => {
    expect(ids(await listar({ desde: "2026-03-05", hasta: "2026-03-05" }))).toEqual([2]);
    expect(ids(await listar({ desde: "2026-03-01", hasta: "2026-03-06" }))).toEqual([3, 2, 1]);
    expect((await listar({ hasta: "2026-03-10" })).total).toBe(4);
  });
  it("extrae operacion y no incluye datos", async () => {
    const r = await listar({ accion: "aprobar" });
    expect(r.items[0]).toMatchObject({ operacion: "aprobar_proveedor", usuario: { id: 2, nombre: "Beto" } });
    expect(r.items[0]).not.toHaveProperty("datosDespues");
  });
  it("rechaza fechas invalidas, rango invertido y tamano excesivo con 400", async () => {
    for (const q of [{ desde: "2026-02-30" }, { hasta: "x" }, { desde: "2026-03-10", hasta: "2026-03-01" }, { tamano: 500 }]) {
      await expect(listar(q)).rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
    }
  });
});

describe("obtenerRegistroAuditoria", () => {
  const repo = repoEnMemoria([
    reg(9, { datosAntes: { a: 1, hash_clave: "$2b$..." }, datosDespues: { anidado: { password: "p", ok: true }, lista: [{ accessToken: "t", x: 1 }] } })
  ]);
  it("enmascara claves sensibles, incluso anidadas", async () => {
    const r = await obtenerRegistroAuditoria({ auditoriaRepository: repo })({ id: "9" });
    expect(r.datosAntes).toEqual({ a: 1, hash_clave: "[oculto]" });
    expect(r.datosDespues).toEqual({ anidado: { password: "[oculto]", ok: true }, lista: [{ accessToken: "[oculto]", x: 1 }] });
  });
  it("404 REGISTRO_NO_ENCONTRADO", async () => {
    await expect(obtenerRegistroAuditoria({ auditoriaRepository: repo })({ id: 1 })).rejects.toMatchObject({
      statusCode: 404, code: "REGISTRO_NO_ENCONTRADO"
    });
  });
  it("enmascararSensibles no toca valores no sensibles", () => {
    expect(enmascararSensibles({ nombre: "x", n: null, f: [1, 2] })).toEqual({ nombre: "x", n: null, f: [1, 2] });
  });
});

describe("obtenerFiltrosAuditoria", () => {
  it("devuelve acciones del enum, entidades y usuarios presentes", async () => {
    const r = await obtenerFiltrosAuditoria({ auditoriaRepository: repoEnMemoria(datos) })();
    expect(r.acciones).toContain("reembolsar");
    expect(r.entidades).toEqual(["producto", "proveedor"]);
    expect(r.usuarios).toEqual([{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Beto" }]);
  });
});
