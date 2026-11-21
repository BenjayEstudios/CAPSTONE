import { describe, expect, it } from "vitest";
import { clpAUsd, PayPal, PAYPAL_URL_SANDBOX } from "./paypal.js";

interface Llamada {
  url: string;
  init: RequestInit;
}

function crear(respuestas: Array<{ status?: number; json: unknown }>) {
  const llamadas: Llamada[] = [];
  let i = 0;
  const fetchFalso = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas[i++] ?? { json: {} };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  const pp = new PayPal({ clientId: "id", clientSecret: "secreto", baseUrl: PAYPAL_URL_SANDBOX, clpPorUsd: 1000, fetch: fetchFalso });
  return { pp, llamadas };
}

const token = { json: { access_token: "AT", expires_in: 3600 } };

describe("PayPal", () => {
  it("clpAUsd convierte con 2 decimales y minimo 0.01", () => {
    expect(clpAUsd(80150, 950)).toBe("84.37");
    expect(clpAUsd(1, 950)).toBe("0.01");
  });

  it("iniciar crea la orden en USD y devuelve la URL de aprobacion con metodo GET", async () => {
    const { pp, llamadas } = crear([token, { json: { id: "5O190127TN364715T", links: [{ rel: "self", href: "x" }, { rel: "approve", href: "https://sandbox.paypal.com/checkoutnow?token=5O190127TN364715T" }] } }]);
    const r = await pp.iniciar({ ordenCompra: "CM-90012", sesionId: "orden-12", monto: 80000, urlRetorno: "https://api.x.cl/pagos/paypal/retorno" });
    expect(r).toEqual({ token: "5O190127TN364715T", url: "https://sandbox.paypal.com/checkoutnow?token=5O190127TN364715T", metodo: "GET" });
    expect(llamadas[0]?.url).toBe(`${PAYPAL_URL_SANDBOX}/v1/oauth2/token`);
    expect((llamadas[0]?.init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("id:secreto").toString("base64")}`);
    const cuerpo = JSON.parse(String(llamadas[1]?.init.body));
    expect(cuerpo.intent).toBe("CAPTURE");
    expect(cuerpo.purchase_units[0]).toMatchObject({ invoice_id: "CM-90012", custom_id: "orden-12|80000", amount: { currency_code: "USD", value: "80.00" } });
    expect(cuerpo.application_context.return_url).toBe("https://api.x.cl/pagos/paypal/retorno?resultado=ok");
    expect(cuerpo.application_context.cancel_url).toBe("https://api.x.cl/pagos/paypal/retorno?resultado=cancelado");
    expect((llamadas[1]?.init.headers as Record<string, string>).Authorization).toBe("Bearer AT");
  });

  it("reutiliza el token de acceso entre llamadas", async () => {
    const { pp, llamadas } = crear([
      token,
      { json: { id: "A", links: [{ rel: "approve", href: "u" }] } },
      { json: { id: "B", links: [{ rel: "approve", href: "u" }] } }
    ]);
    const s = { ordenCompra: "CM-1", sesionId: "orden-1", monto: 1000, urlRetorno: "https://x/r" };
    await pp.iniciar(s);
    await pp.iniciar(s);
    expect(llamadas.filter((l) => l.url.endsWith("/oauth2/token"))).toHaveLength(1);
  });

  it("confirmar: captura COMPLETED es aprobado y devuelve el monto en CLP de custom_id", async () => {
    const { pp, llamadas } = crear([
      token,
      { json: { id: "A", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP1", status: "COMPLETED", custom_id: "orden-12|80150", invoice_id: "CM-90012" }] } }] } }
    ]);
    const t = await pp.confirmar("A");
    expect(llamadas[1]?.url).toBe(`${PAYPAL_URL_SANDBOX}/v2/checkout/orders/A/capture`);
    expect(t).toMatchObject({ aprobado: true, monto: 80150, sesionId: "orden-12", ordenCompra: "CM-90012", codigoAutorizacion: "CAP1", codigoRespuesta: 0 });
  });

  it("confirmar: captura pendiente o declinada no es aprobado", async () => {
    const { pp } = crear([token, { json: { status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "C", status: "PENDING", custom_id: "orden-1|100" }] } }] } }]);
    expect(await pp.confirmar("A")).toMatchObject({ aprobado: false, codigoRespuesta: 1 });
  });

  it("lanza ErrorPayPal si PayPal responde con error", async () => {
    const { pp } = crear([token, { status: 422, json: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED", description: "Payer has not yet approved" }] } }]);
    await expect(pp.confirmar("A")).rejects.toThrow(/422.*not yet approved/);
  });

  it("lanza si las credenciales son invalidas", async () => {
    const { pp } = crear([{ status: 401, json: { error_description: "Client Authentication failed" } }]);
    await expect(pp.iniciar({ ordenCompra: "CM-1", sesionId: "orden-1", monto: 1000, urlRetorno: "https://x/r" })).rejects.toThrow(/401/);
  });
});

describe("PayPal.devolver (KAN-148)", () => {
  const orden = { json: { id: "A", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP9", status: "COMPLETED" }] } }] } };

  it("busca la captura de la orden y la devuelve en USD con la tasa del cobro", async () => {
    const { pp, llamadas } = crear([token, orden, { json: { id: "REF1", status: "COMPLETED" } }]);
    await pp.devolver({ referencia: "A", monto: 5000, ordenCompra: "CM-90001" });
    expect(llamadas[1]?.url).toBe(`${PAYPAL_URL_SANDBOX}/v2/checkout/orders/A`);
    expect(llamadas[1]?.init.method).toBe("GET");
    expect(llamadas[2]?.url).toBe(`${PAYPAL_URL_SANDBOX}/v2/payments/captures/CAP9/refund`);
    const cuerpo = JSON.parse(String(llamadas[2]?.init.body));
    expect(cuerpo.amount).toEqual({ currency_code: "USD", value: "5.00" });
    expect(cuerpo.note_to_payer).toContain("CM-90001");
  });

  it("lanza si la orden no tiene captura o PayPal rechaza la devolucion", async () => {
    const sin = crear([token, { json: { id: "A", purchase_units: [{}] } }]);
    await expect(sin.pp.devolver({ referencia: "A", monto: 1000, ordenCompra: "CM-1" })).rejects.toThrow(/captura/);
    const rechazo = crear([token, orden, { status: 422, json: { details: [{ description: "refund exceeds captured amount" }] } }]);
    await expect(rechazo.pp.devolver({ referencia: "A", monto: 999999, ordenCompra: "CM-1" })).rejects.toThrow(/422.*exceeds/);
  });

  it("una devolucion que PayPal deja en otro estado se considera fallida", async () => {
    const { pp } = crear([token, orden, { json: { id: "R", status: "FAILED" } }]);
    await expect(pp.devolver({ referencia: "A", monto: 1000, ordenCompra: "CM-1" })).rejects.toThrow(/FAILED/);
  });
});
