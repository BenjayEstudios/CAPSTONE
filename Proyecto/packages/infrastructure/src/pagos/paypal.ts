import type { PagoIniciado, PasarelaPago, SolicitudDevolucionPasarela, SolicitudPago, TransaccionPago } from "@cotizapp/domain";

// Adaptador de PasarelaPago para PayPal (Orders API v2, sandbox o produccion).
// https://developer.paypal.com/docs/api/orders/v2/
//
// Mientras no exista cuenta empresa de Webpay, el pago de prueba va por el
// sandbox de PayPal. Flujo:
//  - iniciar  = OAuth (client credentials) + POST /v2/checkout/orders con
//               intent CAPTURE -> { id, links[approve] }. El navegador va a la
//               URL de aprobacion con un GET (no un formulario como Webpay).
//  - retorno  = PayPal vuelve a urlRetorno con ?token=<id>&PayerID=... si el
//               comprador aprobo, o a la misma URL con resultado=cancelado si
//               anulo. Este adaptador agrega resultado=ok|cancelado a la URL.
//  - confirmar = POST /v2/checkout/orders/{id}/capture. Aprobado = captura
//               COMPLETED.
//
// PayPal no acepta CLP: se cobra en USD con una tasa fija configurable
// (clpPorUsd). El monto en CLP viaja en custom_id y es el que se devuelve al
// confirmar, para que la verificacion "cobrado == total de la orden" se haga
// en pesos y no dependa de la tasa vigente al confirmar.

export const PAYPAL_URL_SANDBOX = "https://api-m.sandbox.paypal.com";
export const PAYPAL_URL_PRODUCCION = "https://api-m.paypal.com";
export const PAYPAL_CLP_POR_USD_DEFECTO = 950;

export interface OpcionesPayPal {
  clientId: string;
  clientSecret: string;
  /** PAYPAL_URL_SANDBOX o PAYPAL_URL_PRODUCCION. */
  baseUrl: string;
  /** Pesos chilenos por 1 USD. */
  clpPorUsd?: number;
  timeoutMs?: number;
  /** Para tests. */
  fetch?: typeof fetch;
  /** Para tests. */
  ahora?: () => number;
}

export class ErrorPayPal extends Error {
  constructor(readonly status: number, mensaje: string) {
    super(`PayPal ${status}: ${mensaje}`);
    this.name = "ErrorPayPal";
  }
}

/** CLP -> USD con 2 decimales (PayPal exige string "12.34"); minimo 0.01. */
export function clpAUsd(monto: number, clpPorUsd: number): string {
  return Math.max(0.01, Math.round((monto / clpPorUsd) * 100) / 100).toFixed(2);
}

interface RespuestaOrden {
  id?: string;
  status?: string;
  links?: Array<{ rel?: string; href?: string }>;
  purchase_units?: Array<{
    invoice_id?: string;
    custom_id?: string;
    payments?: { captures?: Array<{ id?: string; status?: string; custom_id?: string; invoice_id?: string }> };
  }>;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
}

export class PayPal implements PasarelaPago {
  readonly nombre = "paypal";
  private readonly fetch: typeof fetch;
  private readonly clpPorUsd: number;
  private readonly ahora: () => number;
  private acceso: { token: string; expira: number } | null = null;

  constructor(private readonly opciones: OpcionesPayPal) {
    this.fetch = opciones.fetch ?? globalThis.fetch;
    this.clpPorUsd = opciones.clpPorUsd ?? PAYPAL_CLP_POR_USD_DEFECTO;
    this.ahora = opciones.ahora ?? Date.now;
  }

  private async token(): Promise<string> {
    if (this.acceso && this.acceso.expira > this.ahora()) return this.acceso.token;
    const basic = Buffer.from(`${this.opciones.clientId}:${this.opciones.clientSecret}`).toString("base64");
    const r = await this.fetch(`${this.opciones.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 15000)
    });
    const texto = await r.text();
    const json = (texto ? JSON.parse(texto) : {}) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!r.ok || !json.access_token) throw new ErrorPayPal(r.status, json.error_description ?? "no se pudo autenticar");
    // Se renueva un minuto antes de que expire.
    this.acceso = { token: json.access_token, expira: this.ahora() + Math.max(0, (json.expires_in ?? 300) - 60) * 1000 };
    return json.access_token;
  }

  private async llamar(ruta: string, cuerpo?: unknown, metodo: "POST" | "GET" = "POST"): Promise<RespuestaOrden> {
    const r = await this.fetch(`${this.opciones.baseUrl}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 15000)
    });
    const texto = await r.text();
    const json = (texto ? JSON.parse(texto) : {}) as RespuestaOrden;
    if (!r.ok) throw new ErrorPayPal(r.status, json.details?.[0]?.description ?? json.message ?? texto.slice(0, 200));
    return json;
  }

  async iniciar(s: SolicitudPago): Promise<PagoIniciado> {
    const conResultado = (resultado: "ok" | "cancelado") => {
      const u = new URL(s.urlRetorno);
      u.searchParams.set("resultado", resultado);
      return u.toString();
    };
    const r = await this.llamar("/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          invoice_id: s.ordenCompra,
          custom_id: `${s.sesionId}|${s.monto}`,
          description: `Cotizapp ${s.ordenCompra}`,
          amount: { currency_code: "USD", value: clpAUsd(s.monto, this.clpPorUsd) }
        }
      ],
      application_context: {
        brand_name: "Cotizapp",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: conResultado("ok"),
        cancel_url: conResultado("cancelado")
      }
    });
    const url = r.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!r.id || !url) throw new ErrorPayPal(502, "PayPal no devolvio la URL de aprobacion");
    return { token: r.id, url, metodo: "GET" };
  }

  async confirmar(token: string): Promise<TransaccionPago> {
    const r = await this.llamar(`/v2/checkout/orders/${encodeURIComponent(token)}/capture`);
    const unidad = r.purchase_units?.[0];
    const captura = unidad?.payments?.captures?.[0];
    const [sesionId = "", monto = "0"] = (captura?.custom_id ?? unidad?.custom_id ?? "").split("|");
    const aprobado = r.status === "COMPLETED" && captura?.status === "COMPLETED";
    return {
      aprobado,
      ordenCompra: captura?.invoice_id ?? unidad?.invoice_id ?? "",
      sesionId,
      monto: Number(monto) || 0,
      codigoAutorizacion: captura?.id ?? null,
      codigoRespuesta: aprobado ? 0 : 1,
      tipoTarjeta: null,
      ultimosDigitos: null,
      cuotas: null
    };
  }

  /**
   * Devolucion (total o parcial) de una captura: GET de la orden para hallar
   * el id de la captura y POST /v2/payments/captures/{id}/refund por el monto
   * convertido a USD con la misma tasa del cobro. PayPal rechaza (y esto
   * lanza) si el acumulado devuelto supera lo capturado.
   */
  async devolver(s: SolicitudDevolucionPasarela): Promise<void> {
    const orden = await this.llamar(`/v2/checkout/orders/${encodeURIComponent(s.referencia)}`, undefined, "GET");
    const captura = orden.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED") ?? orden.purchase_units?.[0]?.payments?.captures?.[0];
    if (!captura?.id) throw new ErrorPayPal(409, "la orden no tiene una captura que devolver");
    const r = await this.llamar(`/v2/payments/captures/${encodeURIComponent(captura.id)}/refund`, {
      amount: { currency_code: "USD", value: clpAUsd(s.monto, this.clpPorUsd) },
      invoice_id: `${s.ordenCompra}-R${this.ahora().toString(36)}`.slice(0, 127),
      note_to_payer: `Reembolso de la orden ${s.ordenCompra}`
    });
    if (r.status && r.status !== "COMPLETED" && r.status !== "PENDING") throw new ErrorPayPal(502, `la devolucion quedo en estado ${r.status}`);
  }
}
