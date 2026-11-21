import { describe, expect, it } from "vitest";
import type { CorreoSaliente, OrdenRepository, ProveedorRepository, ServicioCorreo, UsuarioRepository } from "@cotizapp/domain";
import { notificarOrdenPagada } from "./notificar-orden-pagada.use-case.js";

function setup(opts: { correoFalla?: (c: CorreoSaliente) => boolean; emailProveedor?: Record<number, string | null> } = {}) {
  const enviados: CorreoSaliente[] = [];
  const servicioCorreo: ServicioCorreo = {
    async enviar(c) {
      if (opts.correoFalla?.(c)) throw new Error("smtp caido");
      enviados.push(c);
    }
  };
  const ordenRepository = {
    async buscarPorId(id: number) {
      if (id !== 12) return null;
      return {
        orden: { id: 12, codigo: "CM-90012", usuarioId: 8, total: 80150 },
        envios: [{ proveedorId: 1 }, { proveedorId: 2 }, { proveedorId: 3 }]
      };
    }
  } as unknown as OrdenRepository;
  const usuarioRepository = {
    async buscarPorId() {
      return { usuario: { email: "cliente@x.cl", nombre: "Ana" } };
    }
  } as unknown as UsuarioRepository;
  const emails = opts.emailProveedor ?? { 1: "p1@x.cl", 2: "p2@x.cl", 3: null };
  const proveedorRepository = {
    async perfil(id: number) {
      return { id, razonSocial: `Prov ${id} SpA`, nombreFantasia: id === 1 ? "Fantasia 1" : null, emailContacto: emails[id] ?? null };
    }
  } as unknown as Pick<ProveedorRepository, "perfil">;
  const logs: string[] = [];
  const caso = notificarOrdenPagada({ ordenRepository, usuarioRepository, proveedorRepository, servicioCorreo, log: (m) => logs.push(m) });
  return { caso, enviados, logs };
}

describe("notificarOrdenPagada", () => {
  it("confirma al comprador con el folio y avisa a cada proveedor con email", async () => {
    const { caso, enviados } = setup();
    expect(await caso(12)).toEqual({ enviados: 3, fallidos: 0 });
    expect(enviados[0]).toMatchObject({ para: "cliente@x.cl", asunto: "Confirmacion de compra CM-90012" });
    expect(enviados[0]?.texto).toContain("CM-90012");
    expect(enviados.slice(1).map((c) => c.para)).toEqual(["p1@x.cl", "p2@x.cl"]);
    expect(enviados[1]?.texto).toContain("Fantasia 1");
    expect(enviados[2]?.texto).toContain("Prov 2 SpA");
  });

  it("un correo que falla no corta los demas ni lanza", async () => {
    const { caso, enviados, logs } = setup({ correoFalla: (c) => c.para === "cliente@x.cl" });
    expect(await caso(12)).toEqual({ enviados: 2, fallidos: 1 });
    expect(enviados.map((c) => c.para)).toEqual(["p1@x.cl", "p2@x.cl"]);
    expect(logs).toHaveLength(1);
  });

  it("una orden inexistente no envia nada", async () => {
    const { caso, enviados } = setup();
    expect(await caso(99)).toEqual({ enviados: 0, fallidos: 0 });
    expect(enviados).toHaveLength(0);
  });
});
