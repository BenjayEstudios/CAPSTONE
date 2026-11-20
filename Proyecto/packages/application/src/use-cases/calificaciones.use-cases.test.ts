import { describe, expect, it } from "vitest";
import { CalificacionError, type CalificacionRepository, type RegistrarCalificacionDto, type UsuarioRepository } from "@cotizapp/domain";
import { calificarEnvio } from "./calificaciones.use-cases.js";

const falla = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as { statusCode: number; code: string });

function setup(tipoOrg = "cliente", error?: CalificacionError) {
  const registradas: RegistrarCalificacionDto[] = [];
  const calificacionRepository = {
    async registrar(input: RegistrarCalificacionDto) {
      if (error) throw error;
      registradas.push(input);
      return { id: 30, ...input, comentario: input.comentario ?? null, creadaEn: new Date("2026-11-20T12:00:00Z") };
    }
  } as unknown as CalificacionRepository;
  const usuarioRepository = {
    async buscarPorId(id: number) {
      return { usuario: { id, estado: "activo", organizacionId: 6 }, rol: { codigo: "comprador", permisos: {} }, organizacion: { id: 6, tipo: tipoOrg, estado: "activa" } };
    }
  } as unknown as UsuarioRepository;
  return { registradas, calificar: calificarEnvio({ calificacionRepository, usuarioRepository }) };
}

describe("calificarEnvio (KAN-99)", () => {
  it("registra el puntaje del usuario del token; un comentario vacio queda null", async () => {
    const { registradas, calificar } = setup();
    const r = await calificar(8, 21, { puntaje: 4, comentario: "  Llegó a tiempo  " });
    expect(r).toMatchObject({ id: 30, ordenEnvioId: 21, usuarioId: 8, puntaje: 4, comentario: "Llegó a tiempo" });
    await calificar(8, 22, { puntaje: 5, comentario: "   " });
    expect(registradas[1]).toEqual({ ordenEnvioId: 22, usuarioId: 8, puntaje: 5, comentario: null });
  });

  it("traduce los errores del repositorio y valida el puntaje", async () => {
    expect((await falla(setup("cliente", new CalificacionError("ya_calificado")).calificar(8, 1, { puntaje: 5 })))?.code).toBe("YA_CALIFICADO");
    expect((await falla(setup("cliente", new CalificacionError("envio_no_calificable")).calificar(8, 21, { puntaje: 5 })))?.code).toBe("ENVIO_NO_CALIFICABLE");
    expect((await falla(setup().calificar(8, 21, { puntaje: 6 })))?.statusCode).toBe(400);
    expect((await falla(setup().calificar(8, 21, {})))?.statusCode).toBe(400);
  });

  it("un proveedor no califica (403)", async () => {
    expect((await falla(setup("proveedor").calificar(3, 21, { puntaje: 5 })))?.statusCode).toBe(403);
  });
});
