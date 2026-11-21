import { describe, expect, it } from "vitest";
import type {
  CambioPrecioStock,
  ModeracionCaso,
  ModeracionRepository,
  NuevaOferta,
  OfertaProveedorDto,
  OfertaRepository,
  ProductoParaOfertar,
  UsuarioConContexto,
  UsuarioRepository
} from "@cotizapp/domain";
import {
  actualizarOferta,
  compararMisPrecios,
  crearOferta,
  eliminarOferta,
  historialMiOferta,
  listarMisOfertas,
  obtenerMiOferta,
  precioMaximoSinRevision,
  type DepsOfertas
} from "./ofertas.use-cases.js";

const USUARIO = 4;
const PROVEEDOR = 2;
const productos: Record<number, ProductoParaOfertar> = {
  10: { id: 10, nombre: "Crema", estado: "publicado", precioReferencia: 5490, topeSobreReferenciaPct: 30 },
  11: { id: 11, nombre: "Sin referencia", estado: "publicado", precioReferencia: null, topeSobreReferenciaPct: null },
  12: { id: 12, nombre: "Borrador", estado: "borrador", precioReferencia: 1000, topeSobreReferenciaPct: 30 }
};

function montar(o: { tipoOrg?: "proveedor" | "cliente" | "interna"; estadoOrg?: "activa" | "en_revision"; ventas?: boolean } = {}) {
  const ctx = {
    usuario: { id: USUARIO, estado: "activo" },
    rol: { codigo: "proveedor", permisos: {} },
    organizacion: { id: PROVEEDOR, tipo: o.tipoOrg ?? "proveedor", estado: o.estadoOrg ?? "activa" }
  } as unknown as UsuarioConContexto;
  const ofertas = new Map<number, OfertaProveedorDto>();
  const historial: Array<CambioPrecioStock & { ofertaId: number }> = [];
  const casos: ModeracionCaso[] = [];
  let sec = 100;

  const aDto = (id: number, n: NuevaOferta): OfertaProveedorDto => ({
    id, ...n, cajasIniciales: n.cajasDisponibles, actualizadaEn: new Date(),
    producto: { id: n.productoId, sku: "X", nombre: productos[n.productoId]!.nombre, formato: null, unidad: "L", precioReferencia: productos[n.productoId]!.precioReferencia }
  });
  const ofertaRepository: OfertaRepository = {
    listarDeProveedor: async (pid) => {
      const items = [...ofertas.values()].filter((x) => x.proveedorId === pid);
      return { items, total: items.length };
    },
    buscarPorId: async (id) => ofertas.get(id) ?? null,
    buscarPorProductoYProveedor: async (p, pid) => [...ofertas.values()].find((x) => x.productoId === p && x.proveedorId === pid) ?? null,
    productoParaOfertar: async (id) => productos[id] ?? null,
    productosDisponibles: async () => ({ items: [], total: 0 }),
    tieneVentas: async () => !!o.ventas,
    crear: async (n, h) => {
      const id = ++sec;
      ofertas.set(id, aDto(id, n));
      historial.push({ ofertaId: id, ...h });
      return ofertas.get(id)!;
    },
    actualizar: async (id, c, h) => {
      ofertas.set(id, { ...ofertas.get(id)!, ...c });
      if (h) historial.push({ ofertaId: id, ...h });
      return ofertas.get(id)!;
    },
    eliminar: async (id) => void ofertas.delete(id),
    historial: async (id, limite) =>
      historial
        .filter((h) => h.ofertaId === id)
        .reverse()
        .slice(0, limite)
        .map((h, i) => ({ id: i + 1, precioAnterior: h.precioAnterior, precioNuevo: h.precioNuevo, cajasAnteriores: h.cajasAnteriores, cajasNuevas: h.cajasNuevas, motivo: h.motivo, cambiadoPor: "Ventas", cambiadoEn: new Date() })),
    comparacion: async (pid) =>
      [...ofertas.values()]
        .filter((x) => x.proveedorId === pid && x.estado === "publicada")
        .map((x) => ({ ofertaId: x.id, productoId: x.productoId, producto: x.producto.nombre, formato: null, miPrecio: x.precioUnitario, posicion: 1, total: 1, precioMasBajo: x.precioUnitario, diferencia: 0 }))
  };
  const moderacionRepository = {
    buscarAbierto: async (tipo: string, entidad: string, entidadId: number) =>
      casos.find((c) => c.tipo === tipo && c.entidad === entidad && c.entidadId === entidadId && c.estado === "abierto") ?? null,
    crear: async (n: { tipo: string; entidad: string; entidadId: number; detalle: string | null }) => {
      const caso = { id: casos.length + 1, ...n, estado: "abierto" } as unknown as ModeracionCaso;
      casos.push(caso);
      return caso;
    }
  } as unknown as ModeracionRepository;
  const usuarioRepository = { buscarPorId: async (id: number) => (id === USUARIO ? ctx : null) } as unknown as UsuarioRepository;
  const deps: DepsOfertas = { ofertaRepository, usuarioRepository, moderacionRepository };
  return { deps, ofertas, historial, casos };
}

const base = { productoId: 10, precioUnitario: 5290, cajasDisponibles: 25, modalidadEntrega: "ambos" as const };

describe("precioMaximoSinRevision", () => {
  it("referencia + tope %, redondeado hacia abajo; sin referencia o tope no hay limite", () => {
    expect(precioMaximoSinRevision({ precioReferencia: 5490, topeSobreReferenciaPct: 30 })).toBe(7137);
    expect(precioMaximoSinRevision({ precioReferencia: null, topeSobreReferenciaPct: 30 })).toBeNull();
    expect(precioMaximoSinRevision({ precioReferencia: 5490, topeSobreReferenciaPct: null })).toBeNull();
  });
});

describe("crearOferta", () => {
  it("crea publicada por defecto, con cajas iniciales y fila inicial de historial", async () => {
    const m = montar();
    const r = await crearOferta(m.deps)(USUARIO, base);
    expect(r.revisionPrecio).toBeNull();
    expect(r.oferta).toMatchObject({ proveedorId: PROVEEDOR, estado: "publicada", cajasIniciales: 25 });
    expect(m.historial).toEqual([
      { ofertaId: r.oferta.id, precioAnterior: null, precioNuevo: 5290, cajasAnteriores: null, cajasNuevas: 25, motivo: "Creacion de la oferta", cambiadoPor: USUARIO }
    ]);
  });

  it("sobre el tope no se publica (409 PRECIO_SOBRE_TOPE con el maximo) ni se crea nada (KAN-102)", async () => {
    const m = montar();
    await expect(crearOferta(m.deps)(USUARIO, { ...base, precioUnitario: 7990 })).rejects.toMatchObject({
      statusCode: 409, code: "PRECIO_SOBRE_TOPE", detalle: { precioMaximo: 7137, precioReferencia: 5490, topePct: 30 }
    });
    expect(m.casos).toHaveLength(0);
    // Una publicada tampoco puede subir sobre el tope.
    const ok = await crearOferta(m.deps)(USUARIO, { ...base, precioUnitario: 7000 });
    await expect(actualizarOferta(m.deps)(USUARIO, { id: ok.oferta.id }, { precioUnitario: 8500 })).rejects.toMatchObject({ code: "PRECIO_SOBRE_TOPE" });
  });

  it("sobre el tope como borrador: se guarda y abre un caso precio_fuera_rango (uno solo); publicarlo se rechaza", async () => {
    const m = montar();
    const r = await crearOferta(m.deps)(USUARIO, { ...base, precioUnitario: 7990, estado: "borrador" });
    expect(r.revisionPrecio).toEqual({ casoId: 1, precioReferencia: 5490, topePct: 30, precioMaximo: 7137 });
    expect(m.casos[0]).toMatchObject({ tipo: "precio_fuera_rango", entidad: "oferta", entidadId: r.oferta.id });
    const otra = await actualizarOferta(m.deps)(USUARIO, { id: r.oferta.id }, { precioUnitario: 8500 });
    expect(otra.revisionPrecio?.casoId).toBe(1);
    expect(m.casos).toHaveLength(1);
    await expect(actualizarOferta(m.deps)(USUARIO, { id: r.oferta.id }, { estado: "publicada" })).rejects.toMatchObject({ code: "PRECIO_SOBRE_TOPE" });
    // Bajando el precio al tope si se publica.
    expect((await actualizarOferta(m.deps)(USUARIO, { id: r.oferta.id }, { precioUnitario: 7137, estado: "publicada" })).oferta.estado).toBe("publicada");
  });

  it("justo en el tope no abre caso; sin referencia nunca", async () => {
    const m = montar();
    expect((await crearOferta(m.deps)(USUARIO, { ...base, precioUnitario: 7137 })).revisionPrecio).toBeNull();
    expect((await crearOferta(m.deps)(USUARIO, { ...base, productoId: 11, precioUnitario: 999_999 })).revisionPrecio).toBeNull();
    expect(m.casos).toHaveLength(0);
  });

  it("rechaza duplicada (409), producto no publicado (400) y datos invalidos (400)", async () => {
    const m = montar();
    await crearOferta(m.deps)(USUARIO, base);
    await expect(crearOferta(m.deps)(USUARIO, base)).rejects.toMatchObject({ statusCode: 409, code: "OFERTA_DUPLICADA" });
    await expect(crearOferta(m.deps)(USUARIO, { ...base, productoId: 12 })).rejects.toMatchObject({ statusCode: 400, code: "PRODUCTO_NO_DISPONIBLE" });
    await expect(crearOferta(m.deps)(USUARIO, { ...base, productoId: 11, precioUnitario: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("solo proveedores; un proveedor en revision puede dejar borradores pero no publicar", async () => {
    await expect(crearOferta(montar({ tipoOrg: "interna" }).deps)(USUARIO, base)).rejects.toMatchObject({ statusCode: 403, code: "SOLO_PROVEEDORES" });
    const rev = montar({ estadoOrg: "en_revision" });
    await expect(crearOferta(rev.deps)(USUARIO, base)).rejects.toMatchObject({ statusCode: 409, code: "PROVEEDOR_NO_ACTIVO" });
    expect((await crearOferta(rev.deps)(USUARIO, { ...base, estado: "borrador" })).oferta.estado).toBe("borrador");
  });
});

describe("actualizarOferta", () => {
  it("historial solo si cambia precio o stock, con el motivo", async () => {
    const m = montar();
    const { oferta } = await crearOferta(m.deps)(USUARIO, base);
    const upd = actualizarOferta(m.deps);
    await upd(USUARIO, { id: oferta.id }, { notasCliente: "x", plazoHoras: 48 });
    expect(m.historial).toHaveLength(1);
    await upd(USUARIO, { id: oferta.id }, { precioUnitario: 5590, motivo: "Alza" });
    await upd(USUARIO, { id: oferta.id }, { cajasDisponibles: 10 });
    expect(m.historial.slice(1)).toMatchObject([
      { precioAnterior: 5290, precioNuevo: 5590, cajasAnteriores: 25, cajasNuevas: 25, motivo: "Alza" },
      { precioAnterior: 5590, precioNuevo: 5590, cajasAnteriores: 25, cajasNuevas: 10, motivo: null }
    ]);
  });

  it("pausa y republica; no vuelve a borrador; solo motivo no es un cambio", async () => {
    const m = montar();
    const { oferta } = await crearOferta(m.deps)(USUARIO, base);
    const upd = actualizarOferta(m.deps);
    expect((await upd(USUARIO, { id: oferta.id }, { estado: "pausada" })).oferta.estado).toBe("pausada");
    expect((await upd(USUARIO, { id: oferta.id }, { estado: "publicada" })).oferta.estado).toBe("publicada");
    await expect(upd(USUARIO, { id: oferta.id }, { estado: "borrador" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(upd(USUARIO, { id: oferta.id }, { motivo: "nada" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("una oferta de otro proveedor responde 404, como si no existiera", async () => {
    const m = montar();
    const { oferta } = await crearOferta(m.deps)(USUARIO, base);
    m.ofertas.set(oferta.id, { ...oferta, proveedorId: 999 });
    await expect(obtenerMiOferta(m.deps)(USUARIO, { id: oferta.id })).rejects.toMatchObject({ statusCode: 404, code: "OFERTA_NO_ENCONTRADA" });
    await expect(actualizarOferta(m.deps)(USUARIO, { id: oferta.id }, { precioUnitario: 1 })).rejects.toMatchObject({ statusCode: 404 });
    expect((await listarMisOfertas(m.deps)(USUARIO, {})).total).toBe(0);
    await expect(historialMiOferta(m.deps)(USUARIO, { id: oferta.id })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("historial (KAN-103): el alta y cada cambio de precio o stock, del mas nuevo al mas viejo", async () => {
    const m = montar();
    const { oferta } = await crearOferta(m.deps)(USUARIO, { ...base, precioUnitario: 7000, cajasDisponibles: 30 });
    await actualizarOferta(m.deps)(USUARIO, { id: oferta.id }, { precioUnitario: 6800, motivo: "Ajuste de lista" });
    await actualizarOferta(m.deps)(USUARIO, { id: oferta.id }, { notasCliente: "Caja cerrada" });
    await actualizarOferta(m.deps)(USUARIO, { id: oferta.id }, { cajasDisponibles: 45 });
    const { items } = await historialMiOferta(m.deps)(USUARIO, { id: oferta.id });
    expect(items.map((h) => [h.precioAnterior, h.precioNuevo, h.cajasAnteriores, h.cajasNuevas, h.motivo])).toEqual([
      [6800, 6800, 30, 45, null],
      [7000, 6800, 30, 30, "Ajuste de lista"],
      [null, 7000, null, 30, "Creacion de la oferta"]
    ]);
  });
});

describe("eliminarOferta", () => {
  it("borra un borrador sin ventas; lo publicado o con ventas -> 409", async () => {
    const m = montar();
    const borrador = (await crearOferta(m.deps)(USUARIO, { ...base, estado: "borrador" })).oferta;
    await eliminarOferta(m.deps)(USUARIO, { id: borrador.id });
    expect(m.ofertas.has(borrador.id)).toBe(false);

    const publicada = (await crearOferta(m.deps)(USUARIO, base)).oferta;
    await expect(eliminarOferta(m.deps)(USUARIO, { id: publicada.id })).rejects.toMatchObject({ statusCode: 409, code: "OFERTA_NO_ELIMINABLE" });

    const conVentas = montar({ ventas: true });
    const b2 = (await crearOferta(conVentas.deps)(USUARIO, { ...base, estado: "borrador" })).oferta;
    await expect(eliminarOferta(conVentas.deps)(USUARIO, { id: b2.id })).rejects.toMatchObject({ code: "OFERTA_NO_ELIMINABLE" });
  });
});

describe("compararMisPrecios (KAN-104)", () => {
  it("compara las ofertas publicadas de la organizacion del usuario", async () => {
    const m = montar();
    const publicada = (await crearOferta(m.deps)(USUARIO, base)).oferta;
    await crearOferta(m.deps)(USUARIO, { ...base, productoId: 11, estado: "borrador" });
    const { items } = await compararMisPrecios(m.deps)(USUARIO);
    expect(items).toEqual([expect.objectContaining({ ofertaId: publicada.id, miPrecio: 5290 })]);
  });

  it("solo un proveedor tiene comparacion", async () => {
    await expect(compararMisPrecios(montar({ tipoOrg: "cliente" }).deps)(USUARIO)).rejects.toMatchObject({ statusCode: 403 });
  });
});
