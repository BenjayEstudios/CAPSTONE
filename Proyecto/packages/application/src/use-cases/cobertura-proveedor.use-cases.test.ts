import { describe, expect, it } from "vitest";
import type { ComunaRepository, CondicionesEntregaProveedor, ProveedorRepository, PuntoRetiroProveedor, RegistroAuditoria } from "@cotizapp/domain";
import {
  actualizarPuntoRetiro,
  actualizarZona,
  crearPuntoRetiro,
  crearZona,
  eliminarPuntoRetiro,
  eliminarZona,
  misPuntosRetiro,
  regionesParaCobertura
} from "./cobertura-proveedor.use-cases.js";

const COMUNAS = [
  { id: 1, nombre: "Valparaíso", regionCodigo: "05", regionNombre: "Valparaíso" },
  { id: 20, nombre: "Ñuñoa", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" },
  { id: 25, nombre: "Quilicura", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" }
];
const DIR = { calle: "Av. X", numero: "1", complemento: null, comunaId: 25, comuna: "Quilicura", region: "Metropolitana de Santiago" };

function montar(o: { ofreceRetiro?: boolean; puntos?: PuntoRetiroProveedor[] } = {}) {
  const st = {
    cobertura: {
      horaCorte: "14:00", despachoGratisDesde: null, plazoEstandarHoras: 24, ofreceDespacho: true, ofreceRetiro: o.ofreceRetiro ?? true,
      zonas: [{ id: 7, comunaId: null, comuna: null, regionCodigo: "13", region: "Metropolitana de Santiago", costoDespacho: 4990, plazoHoras: 24 }]
    } as CondicionesEntregaProveedor,
    puntos: o.puntos ?? [
      { id: 1, nombre: "Bodega Quilicura", horario: "L-V", activo: true, usado: true, direccion: DIR },
      { id: 2, nombre: "Bodega 2", horario: null, activo: true, usado: false, direccion: DIR }
    ],
    llamadas: [] as Array<[string, ...unknown[]]>,
    auditoria: [] as RegistroAuditoria[]
  };
  const proveedorRepository = {
    cobertura: async () => st.cobertura,
    puntosRetiro: async () => st.puntos,
    crearZona: async (pid: number, z: unknown, a: RegistroAuditoria) => (st.llamadas.push(["crearZona", pid, z]), st.auditoria.push(a), 99),
    actualizarZona: async (pid: number, id: number, c: unknown, a: RegistroAuditoria) => (st.llamadas.push(["actualizarZona", pid, id, c]), st.auditoria.push(a), true),
    eliminarZona: async (pid: number, id: number, a: RegistroAuditoria) => (st.llamadas.push(["eliminarZona", pid, id]), st.auditoria.push(a), true),
    crearPuntoRetiro: async (pid: number, p: unknown, a: RegistroAuditoria) => (st.llamadas.push(["crearPunto", pid, p]), st.auditoria.push(a), 50),
    actualizarPuntoRetiro: async (pid: number, id: number, c: { activo?: boolean }, a: RegistroAuditoria) => {
      st.llamadas.push(["actualizarPunto", pid, id, c]);
      st.auditoria.push(a);
      st.puntos = st.puntos.map((p) => (p.id === id && c.activo !== undefined ? { ...p, activo: c.activo } : p));
      return true;
    },
    eliminarPuntoRetiro: async (pid: number, id: number, a: RegistroAuditoria) => (st.llamadas.push(["eliminarPunto", pid, id]), st.auditoria.push(a), true)
  } as unknown as ProveedorRepository;
  const comunaRepository = { listar: async () => COMUNAS } as ComunaRepository;
  return { st, deps: { proveedorRepository, comunaRepository } };
}

describe("cobertura de despacho (KAN-109)", () => {
  it("regiones con sus comunas para elegir una zona", async () => {
    const r = await regionesParaCobertura(montar().deps)();
    expect(r).toEqual([
      { codigo: "05", nombre: "Valparaíso", comunas: [{ id: 1, nombre: "Valparaíso" }] },
      { codigo: "13", nombre: "Metropolitana de Santiago", comunas: [{ id: 20, nombre: "Ñuñoa" }, { id: 25, nombre: "Quilicura" }] }
    ]);
  });

  it("crea una zona por comuna (la region sale de la comuna) o por region, y la audita", async () => {
    const { deps, st } = montar();
    expect(await crearZona(deps)(4, 2, { comunaId: 1, regionCodigo: "13", costoDespacho: 7990, plazoHoras: 48 })).toEqual({ id: 99 });
    expect(st.llamadas[0]).toEqual(["crearZona", 2, { comunaId: 1, regionCodigo: "05", costoDespacho: 7990, plazoHoras: 48 }]);
    await crearZona(deps)(4, 2, { regionCodigo: "05", costoDespacho: 9990 });
    expect(st.llamadas[1]).toEqual(["crearZona", 2, { comunaId: null, regionCodigo: "05", costoDespacho: 9990, plazoHoras: null }]);
    expect(st.auditoria[0]).toMatchObject({ usuarioId: 4, entidad: "proveedor_cobertura", accion: "crear", datosDespues: { operacion: "crear_zona" } });
  });

  it("zona repetida 409; comuna o region inexistente 400; sin comuna ni region 400", async () => {
    const { deps } = montar();
    await expect(crearZona(deps)(4, 2, { regionCodigo: "13", costoDespacho: 1 })).rejects.toMatchObject({ statusCode: 409, code: "ZONA_DUPLICADA" });
    await expect(crearZona(deps)(4, 2, { comunaId: 999, costoDespacho: 1 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(crearZona(deps)(4, 2, { regionCodigo: "99", costoDespacho: 1 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(crearZona(deps)(4, 2, { costoDespacho: 1 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(crearZona(deps)(4, 2, { regionCodigo: "05", costoDespacho: -1 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("edita costo y plazo, y borra; una zona ajena 404", async () => {
    const { deps, st } = montar();
    expect(await actualizarZona(deps)(4, 2, 7, { costoDespacho: 3990 })).toMatchObject({ id: 7, costoDespacho: 3990, plazoHoras: 24 });
    expect(st.auditoria[0]).toMatchObject({ entidadId: 7, accion: "editar", datosAntes: { costoDespacho: 4990, plazoHoras: 24 } });
    await expect(actualizarZona(deps)(4, 2, 8, { costoDespacho: 1 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(actualizarZona(deps)(4, 2, 7, { comunaId: 1 })).rejects.toMatchObject({ statusCode: 400 });
    await eliminarZona(deps)(4, 2, 7);
    expect(st.llamadas.at(-1)).toEqual(["eliminarZona", 2, 7]);
    await expect(eliminarZona(deps)(4, 2, 8)).rejects.toMatchObject({ statusCode: 404 });
    await expect(eliminarZona(deps)(4, Number.NaN, 7)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("puntos de retiro (KAN-109)", () => {
  it("lista y crea (activo por defecto)", async () => {
    const { deps, st } = montar();
    expect((await misPuntosRetiro(deps)(2)).items).toHaveLength(2);
    expect(await crearPuntoRetiro(deps)(4, 2, { nombre: "Bodega Ñuñoa", horario: "", direccion: { calle: "Pedro de Valdivia", comunaId: 20 } })).toEqual({ id: 50 });
    expect(st.llamadas[0]).toEqual(["crearPunto", 2, { nombre: "Bodega Ñuñoa", horario: null, activo: true, direccion: { calle: "Pedro de Valdivia", numero: null, complemento: null, comunaId: 20 } }]);
    await expect(crearPuntoRetiro(deps)(4, 2, { nombre: "X", direccion: { calle: "Y", comunaId: 999 } })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("desactiva y reactiva; no deja sin puntos activos a quien ofrece retiro", async () => {
    const { deps, st } = montar();
    expect(await actualizarPuntoRetiro(deps)(4, 2, 2, { activo: false })).toMatchObject({ id: 2, activo: false });
    await expect(actualizarPuntoRetiro(deps)(4, 2, 1, { activo: false })).rejects.toMatchObject({ statusCode: 409, code: "ULTIMO_PUNTO_RETIRO" });
    expect(await actualizarPuntoRetiro(deps)(4, 2, 2, { activo: true })).toMatchObject({ activo: true });
    await expect(actualizarPuntoRetiro(deps)(4, 2, 3, { nombre: "X" })).rejects.toMatchObject({ statusCode: 404 });
    expect(st.auditoria[0]).toMatchObject({ entidad: "punto_retiro", entidadId: 2, datosAntes: { activo: true }, datosDespues: { operacion: "editar_punto_retiro", activo: false } });
    // Solo despacho: puede quedar sin puntos activos.
    const soloDespacho = montar({ ofreceRetiro: false, puntos: [{ id: 1, nombre: "B", horario: null, activo: true, usado: false, direccion: DIR }] });
    expect(await actualizarPuntoRetiro(soloDespacho.deps)(4, 2, 1, { activo: false })).toMatchObject({ activo: false });
  });

  it("borra un punto sin retiros; uno usado se desactiva (409 PUNTO_USADO)", async () => {
    const { deps, st } = montar();
    await eliminarPuntoRetiro(deps)(4, 2, 2);
    expect(st.llamadas.at(-1)).toEqual(["eliminarPunto", 2, 2]);
    await expect(eliminarPuntoRetiro(deps)(4, 2, 1)).rejects.toMatchObject({ statusCode: 409, code: "PUNTO_USADO" });
    const unico = montar({ puntos: [{ id: 5, nombre: "B", horario: null, activo: true, usado: false, direccion: DIR }] });
    await expect(eliminarPuntoRetiro(unico.deps)(4, 2, 5)).rejects.toMatchObject({ statusCode: 409, code: "ULTIMO_PUNTO_RETIRO" });
  });
});
