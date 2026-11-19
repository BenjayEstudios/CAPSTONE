import { describe, expect, it } from "vitest";
import type { Producto, RegistroAuditoria } from "@cotizapp/domain";
import { auditoriaCrearProducto, auditoriaEditarProducto } from "./producto-auditoria.js";
import { crearProducto } from "./crear-producto.use-case.js";
import { actualizarProducto } from "./actualizar-producto.use-case.js";

const p: Producto = {
  id: 4, categoriaId: 2, sku: "A-1", ean: null, nombre: "Arroz", marca: null, formato: null, contenido: null, unidad: "kg",
  descripcion: "texto largo", precioReferencia: 1000, topeSobreReferenciaPct: 10, imagenes: [], estado: "borrador",
  creadoPor: 1, creadoEn: new Date()
};

describe("auditoria de productos", () => {
  it("crear registra campos de la ficha sin descripcion", () => {
    const r = auditoriaCrearProducto(7)(p);
    expect(r).toMatchObject({ usuarioId: 7, entidad: "producto", entidadId: 4, accion: "crear", datosAntes: null });
    expect(JSON.stringify(r.datosDespues)).not.toContain("texto largo");
  });
  it("editar solo incluye campos cambiados y detecta publicar/archivar", () => {
    const r = auditoriaEditarProducto(7, p, { nombre: "Arroz 2", estado: "publicado", descripcion: "otro" });
    expect(r.accion).toBe("editar");
    expect(r.datosAntes).toEqual({ nombre: "Arroz", estado: "borrador" });
    expect(r.datosDespues).toMatchObject({ operacion: "publicar_producto", nombre: "Arroz 2", descripcionModificada: true });
    expect(auditoriaEditarProducto(7, p, { estado: "archivado" }).datosDespues).toMatchObject({ operacion: "archivar_producto" });
    expect(auditoriaEditarProducto(7, p, { nombre: "x" }).datosDespues).toMatchObject({ operacion: "editar_producto" });
  });
  it("los casos de uso pasan la auditoria al repositorio", async () => {
    const guardados: RegistroAuditoria[] = [];
    const repo = {
      buscarPorSku: async () => null, buscarPorEan: async () => null, buscarPorId: async () => ({ ...p }),
      resumenOfertas: async () => ({ proveedoresConOfertaActiva: 0, precioDesde: null }),
      crear: async (_i: unknown, a?: (x: Producto) => RegistroAuditoria) => { if (a) guardados.push(a(p)); return p; },
      actualizar: async (_id: number, c: object, a?: RegistroAuditoria) => { if (a) guardados.push(a); return { ...p, ...c }; }
    };
    const cat = { buscarPorId: async () => ({ id: 2, padreId: null, nombre: "C", slug: "c", orden: 1, estado: "activa" }) };
    const deps = { productoRepository: repo, categoriaRepository: cat } as never;
    await crearProducto(deps)({ nombre: "Arroz", sku: "a-1", categoriaId: 2, unidad: "kg" }, 3);
    await actualizarProducto(deps)(4, { nombre: "Nuevo" }, 3);
    expect(guardados.map((g) => [g.accion, g.usuarioId])).toEqual([["crear", 3], ["editar", 3]]);
  });
});
