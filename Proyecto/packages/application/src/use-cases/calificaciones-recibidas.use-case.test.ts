import { describe, expect, it } from "vitest";
import type { CalificacionRepository, ProveedorRepository, UsuarioRepository } from "@cotizapp/domain";
import { calificacionesRecibidas } from "./calificaciones.use-cases.js";

const falla = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as { statusCode: number; code: string });

function setup(opts: { tipo?: string; estado?: string; sinUsuario?: boolean } = {}) {
  const llamadas: Array<{ proveedorId: number; pagina: number; tamano: number }> = [];
  const usuarioRepository = {
    async buscarPorId() {
      if (opts.sinUsuario) return null;
      return { usuario: { estado: opts.estado ?? "activo" }, organizacion: { id: 2, tipo: opts.tipo ?? "proveedor" } };
    }
  } as unknown as UsuarioRepository;
  const calificacionRepository = {
    async resumenRecibidas() {
      return { promedio: 4.67, cantidad: 6, distribucion: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 4 } };
    },
    async listarRecibidas(proveedorId: number, p: { pagina: number; tamano: number }) {
      llamadas.push({ proveedorId, ...p });
      return {
        total: 6,
        items: [{ id: 15, ordenEnvioId: 17, ordenCodigo: "CM-10009", cliente: "El Fogon", puntaje: 5, comentario: null, creadaEn: new Date("2026-10-15T15:45:00Z") }]
      };
    }
  } as unknown as CalificacionRepository;
  const proveedorRepository = { async perfil() { return { entregasATiempoPct: 96.5 }; } } as unknown as Pick<ProveedorRepository, "perfil">;
  return { llamadas, caso: calificacionesRecibidas({ calificacionRepository, usuarioRepository, proveedorRepository }) };
}

describe("calificacionesRecibidas (KAN-200)", () => {
  it("devuelve el shape del contrato mas la paginacion, del proveedor de la sesion", async () => {
    const { caso, llamadas } = setup();
    const r = await caso(9, { pagina: "2", tamano: "5" });
    expect(r.resumen).toEqual({ promedio: 4.67, cantidad: 6, distribucion: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 4 } });
    expect(r.entregasATiempoPct).toBe(96.5);
    expect(r.items[0]).toMatchObject({ ordenCodigo: "CM-10009", cliente: "El Fogon", puntaje: 5 });
    expect(r).toMatchObject({ total: 6, pagina: 2, tamano: 5 });
    expect(llamadas).toEqual([{ proveedorId: 2, pagina: 2, tamano: 5 }]);
  });

  it("pagina 1 y 20 por defecto", async () => {
    const { caso, llamadas } = setup();
    await caso(9, undefined);
    expect(llamadas[0]).toMatchObject({ pagina: 1, tamano: 20 });
  });

  it("rechaza a quien no es proveedor (403), sesion invalida (401) y paginacion invalida (400)", async () => {
    expect(await falla(setup({ tipo: "cliente" }).caso(9, {}))).toMatchObject({ statusCode: 403 });
    expect(await falla(setup({ tipo: "interna" }).caso(9, {}))).toMatchObject({ statusCode: 403 });
    expect(await falla(setup({ sinUsuario: true }).caso(9, {}))).toMatchObject({ statusCode: 401 });
    expect(await falla(setup({ estado: "suspendido" }).caso(9, {}))).toMatchObject({ statusCode: 401 });
    expect(await falla(setup().caso(9, { tamano: "500" }))).toMatchObject({ statusCode: 400 });
  });
});
