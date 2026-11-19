import { describe, expect, it } from "vitest";
import type { EventoModeracion, ModeracionCaso, ModeracionRepository, RegistroAuditoria } from "@cotizapp/domain";
import {
  abrirCasoModeracion,
  asignarCasoModeracion,
  descartarCasoModeracion,
  listarCasosModeracion,
  obtenerCasoModeracion,
  resolverCasoModeracion
} from "./moderacion.use-cases.js";

function repoEnMemoria(inicial: ModeracionCaso[] = []) {
  const datos = [...inicial];
  const auditoria: RegistroAuditoria[] = [];
  let seq = Math.max(0, ...datos.map((c) => c.id));
  const repo: ModeracionRepository & { datos: ModeracionCaso[]; auditoria: RegistroAuditoria[]; ultimosFiltros?: unknown } = {
    datos,
    auditoria,
    listar: async (f) => {
      repo.ultimosFiltros = f;
      return { items: datos, total: datos.length };
    },
    buscarPorId: async (id) => datos.find((c) => c.id === id) ?? null,
    buscarAbierto: async (t, e, eid) =>
      datos.find((c) => c.tipo === t && c.entidad === e && c.entidadId === eid && c.estado === "abierto") ?? null,
    historial: async (): Promise<EventoModeracion[]> =>
      auditoria.map((a) => ({
        operacion: String((a.datosDespues as Record<string, unknown>).operacion),
        usuario: a.usuarioId ? { id: a.usuarioId, nombre: `U${a.usuarioId}` } : null,
        creadoEn: new Date(),
        nota: ((a.datosDespues as Record<string, unknown>).nota as string) ?? null,
        asignadoA: null
      })),
    resolverEntidad: async (entidad, id) => (entidad === "organizacion" ? { entidad, id, etiqueta: "Prov SpA" } : null),
    usuariosInternos: async () => [{ id: 5, nombre: "Ana", rol: "administrador" }],
    crear: async (i, aud) => {
      const c: ModeracionCaso = {
        id: ++seq, tipo: i.tipo, entidad: i.entidad, entidadId: i.entidadId, detalle: i.detalle, estado: "abierto",
        asignadoA: null, creadoEn: new Date(), resueltoEn: null
      };
      datos.push(c);
      auditoria.push(aud(c.id));
      return c;
    },
    cambiar: async (id, cambio, aud) => {
      const c = datos.find((x) => x.id === id);
      if (!c || c.estado !== "abierto") return null;
      if (cambio.estado) c.estado = cambio.estado;
      if (cambio.asignadoA !== undefined) c.asignadoA = cambio.asignadoA === null ? null : { id: cambio.asignadoA, nombre: "Ana" };
      if (cambio.resueltoEn !== undefined) c.resueltoEn = cambio.resueltoEn;
      auditoria.push(aud);
      return c;
    }
  };
  return repo;
}
const caso = (id: number, estado: ModeracionCaso["estado"] = "abierto"): ModeracionCaso => ({
  id, tipo: "alta_proveedor", entidad: "organizacion", entidadId: 9, detalle: null, estado, asignadoA: null,
  creadoEn: new Date(), resueltoEn: null
});

describe("listar / obtener", () => {
  it("valida filtros y pagina", async () => {
    const r = repoEnMemoria([caso(1)]);
    const out = await listarCasosModeracion({ moderacionRepository: r })({ estado: "abierto", asignadoA: "sin_asignar", tamano: "10" });
    expect(r.ultimosFiltros).toMatchObject({ estado: "abierto", asignadoA: "sin_asignar", tamano: 10, pagina: 1 });
    expect(out.totalPaginas).toBe(1);
    await expect(listarCasosModeracion({ moderacionRepository: r })({ tipo: "x" })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("detalle con entidad referenciada y 404", async () => {
    const r = repoEnMemoria([caso(1)]);
    const d = await obtenerCasoModeracion({ moderacionRepository: r })({ id: "1" });
    expect(d.entidadReferenciada).toMatchObject({ etiqueta: "Prov SpA" });
    await expect(obtenerCasoModeracion({ moderacionRepository: r })({ id: "99" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("asignar / resolver / descartar", () => {
  it("asignar escribe auditoria y valida usuario interno", async () => {
    const r = repoEnMemoria([caso(1)]);
    const out = await asignarCasoModeracion({ moderacionRepository: r })({ id: 1 }, { usuarioId: 5 }, 2);
    expect(out.asignadoA?.id).toBe(5);
    expect(r.auditoria[0]).toMatchObject({ usuarioId: 2, entidad: "moderacion_caso", accion: "editar" });
    await expect(asignarCasoModeracion({ moderacionRepository: r })({ id: 1 }, { usuarioId: 77 }, 2)).rejects.toMatchObject({
      code: "USUARIO_INVALIDO"
    });
    const sin = await asignarCasoModeracion({ moderacionRepository: r })({ id: 1 }, { usuarioId: null }, 2);
    expect(sin.asignadoA).toBeNull();
  });
  it("resolver y descartar exigen texto y estado abierto", async () => {
    const r = repoEnMemoria([caso(1), caso(2)]);
    const d = { moderacionRepository: r };
    await expect(resolverCasoModeracion(d)({ id: 1 }, { nota: "  " }, 2)).rejects.toMatchObject({ statusCode: 400 });
    await expect(descartarCasoModeracion(d)({ id: 1 }, { motivo: "x".repeat(501) }, 2)).rejects.toMatchObject({ statusCode: 400 });
    const res = await resolverCasoModeracion(d)({ id: 1 }, { nota: "ok" }, 2);
    expect(res.estado).toBe("resuelto");
    expect(res.resueltoEn).toBeInstanceOf(Date);
    expect(r.auditoria[0].datosDespues).toMatchObject({ operacion: "resolver_caso", nota: "ok" });
    await expect(resolverCasoModeracion(d)({ id: 1 }, { nota: "ok" }, 2)).rejects.toMatchObject({ statusCode: 409, code: "TRANSICION_INVALIDA" });
    await expect(asignarCasoModeracion(d)({ id: 1 }, { usuarioId: 5 }, 2)).rejects.toMatchObject({ code: "TRANSICION_INVALIDA" });
    const des = await descartarCasoModeracion(d)({ id: 2 }, { motivo: "falso" }, 2);
    expect(des.estado).toBe("descartado");
    expect(r.auditoria.at(-1)?.datosDespues).toMatchObject({ operacion: "descartar_caso", motivo: "falso" });
  });
});

describe("abrirCasoModeracion", () => {
  it("crea y no duplica abiertos de la misma entidad+tipo", async () => {
    const r = repoEnMemoria();
    const abrir = abrirCasoModeracion({ moderacionRepository: r });
    const a = await abrir("precio_fuera_rango", "oferta", 3, "Precio alto");
    expect(a.creado).toBe(true);
    expect(r.auditoria[0]).toMatchObject({ accion: "crear", usuarioId: null, entidadId: a.caso.id });
    const b = await abrir("precio_fuera_rango", "oferta", 3);
    expect(b).toMatchObject({ creado: false });
    expect(b.caso.id).toBe(a.caso.id);
    expect((await abrir("reembolso", "oferta", 3)).creado).toBe(true);
    await resolverCasoModeracion({ moderacionRepository: r })({ id: a.caso.id }, { nota: "ok" }, 1);
    expect((await abrir("precio_fuera_rango", "oferta", 3)).creado).toBe(true);
  });
  it("valida descripcion > 300", async () => {
    await expect(abrirCasoModeracion({ moderacionRepository: repoEnMemoria() })("reembolso", "orden", 1, "x".repeat(301))).rejects.toMatchObject({ statusCode: 400 });
  });
});
