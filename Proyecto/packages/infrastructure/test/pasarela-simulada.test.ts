import { describe, expect, it } from "vitest";
import { PasarelaSimulada } from "../src/pagos/pasarela-simulada.js";

// Sin base de datos: la pasarela simulada de las pruebas end-to-end (KAN-164).
describe("PasarelaSimulada", () => {
  const solicitud = { ordenCompra: "CM-90020", sesionId: "8", monto: 41690, urlRetorno: "http://localhost:8000/pagos/webpay/retorno" };

  it("aprueba una sola vez el pago que inicio, por su monto; la pagina de pago es el retorno", async () => {
    const p = new PasarelaSimulada();
    const { token, url } = await p.iniciar(solicitud);
    expect(token).toMatch(/^sim-[0-9a-f-]{36}$/);
    expect(url).toBe(solicitud.urlRetorno);
    expect(await p.confirmar(token)).toMatchObject({ aprobado: true, ordenCompra: "CM-90020", sesionId: "8", monto: 41690, codigoRespuesta: 0 });
    expect((await p.confirmar(token)).aprobado).toBe(false);
  });

  it("un token que no inicio (o de antes de reiniciar) se rechaza", async () => {
    expect(await new PasarelaSimulada().confirmar("tok-inventado")).toMatchObject({ aprobado: false, codigoRespuesta: -1 });
  });
});
