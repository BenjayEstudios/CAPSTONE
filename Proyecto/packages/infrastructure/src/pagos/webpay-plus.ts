import type { PagoIniciado, PasarelaPago, SolicitudPago, TipoTarjeta, TransaccionPago } from "@cotizapp/domain";

// Adaptador de PasarelaPago para Webpay Plus de Transbank (API REST v1.2).
// https://www.transbankdevelopers.cl/referencia/webpay
//
// Flujo: iniciar = POST /transactions -> { token, url }; el navegador envia
// token_ws a esa url; Transbank devuelve al comprador a urlRetorno con
// token_ws (o TBK_TOKEN si anulo) y confirmar = PUT /transactions/{token}
// (commit). Aprobado = status AUTHORIZED y response_code 0.

export const WEBPAY_URL_INTEGRACION = "https://webpay3gint.transbank.cl";
export const WEBPAY_URL_PRODUCCION = "https://webpay3g.transbank.cl";
/** Credenciales publicas del ambiente de integracion (Webpay Plus), publicadas por Transbank. */
export const WEBPAY_INTEGRACION = {
  codigoComercio: "597055555532",
  apiKey: "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"
} as const;

const RUTA = "/rswebpaytransaction/api/webpay/v1.2/transactions";

export interface OpcionesWebpay {
  codigoComercio: string;
  apiKey: string;
  /** WEBPAY_URL_INTEGRACION o WEBPAY_URL_PRODUCCION. */
  baseUrl: string;
  timeoutMs?: number;
  /** Para tests. */
  fetch?: typeof fetch;
}

interface RespuestaCommit {
  status?: string;
  response_code?: number;
  amount?: number;
  buy_order?: string;
  session_id?: string;
  authorization_code?: string;
  payment_type_code?: string;
  installments_number?: number;
  card_detail?: { card_number?: string };
}

/** VD debito, VP prepago; el resto (VN, VC, SI, S2, NC) es credito. */
export function tipoTarjetaWebpay(codigo: string | undefined): TipoTarjeta | null {
  if (!codigo) return null;
  if (codigo === "VD") return "debito";
  if (codigo === "VP") return "prepago";
  return "credito";
}

export class ErrorWebpay extends Error {
  constructor(readonly status: number, mensaje: string) {
    super(`Webpay ${status}: ${mensaje}`);
    this.name = "ErrorWebpay";
  }
}

export class WebpayPlus implements PasarelaPago {
  readonly nombre = "webpay";
  private readonly fetch: typeof fetch;

  constructor(private readonly opciones: OpcionesWebpay) {
    this.fetch = opciones.fetch ?? globalThis.fetch;
  }

  private async llamar<T>(metodo: "POST" | "PUT", ruta: string, cuerpo?: unknown): Promise<T> {
    const r = await this.fetch(`${this.opciones.baseUrl}${ruta}`, {
      method: metodo,
      headers: {
        "Tbk-Api-Key-Id": this.opciones.codigoComercio,
        "Tbk-Api-Key-Secret": this.opciones.apiKey,
        "Content-Type": "application/json"
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 15000)
    });
    const texto = await r.text();
    const json = texto ? (JSON.parse(texto) as T & { error_message?: string }) : ({} as T & { error_message?: string });
    if (!r.ok) throw new ErrorWebpay(r.status, json.error_message ?? texto.slice(0, 200));
    return json;
  }

  async iniciar(s: SolicitudPago): Promise<PagoIniciado> {
    const r = await this.llamar<{ token: string; url: string }>("POST", RUTA, {
      buy_order: s.ordenCompra,
      session_id: s.sesionId,
      amount: s.monto,
      return_url: s.urlRetorno
    });
    return { token: r.token, url: r.url };
  }

  async confirmar(token: string): Promise<TransaccionPago> {
    const r = await this.llamar<RespuestaCommit>("PUT", `${RUTA}/${encodeURIComponent(token)}`);
    return {
      aprobado: r.status === "AUTHORIZED" && r.response_code === 0,
      ordenCompra: r.buy_order ?? "",
      sesionId: r.session_id ?? "",
      monto: r.amount ?? 0,
      codigoAutorizacion: r.authorization_code ?? null,
      codigoRespuesta: r.response_code ?? null,
      tipoTarjeta: tipoTarjetaWebpay(r.payment_type_code),
      ultimosDigitos: r.card_detail?.card_number ?? null,
      cuotas: r.installments_number ?? null
    };
  }
}
