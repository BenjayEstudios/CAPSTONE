import type { PagoIniciado, PasarelaPago, SolicitudPago, TransaccionPago } from "@cotizapp/domain";

// PasarelaPago para tests: guarda las solicitudes y responde lo que se le
// indique por token (por defecto, aprobado por el monto solicitado).
export class PasarelaEnMemoria implements PasarelaPago {
  readonly nombre = "memoria";
  readonly solicitudes: SolicitudPago[] = [];
  readonly confirmados: string[] = [];
  private readonly respuestas = new Map<string, Partial<TransaccionPago> | Error>();
  private siguiente = 1;

  responder(token: string, r: Partial<TransaccionPago> | Error): void {
    this.respuestas.set(token, r);
  }

  async iniciar(s: SolicitudPago): Promise<PagoIniciado> {
    this.solicitudes.push(s);
    const token = `tok-${this.siguiente++}`;
    return { token, url: "https://pasarela.test/pagar" };
  }

  async confirmar(token: string): Promise<TransaccionPago> {
    this.confirmados.push(token);
    const r = this.respuestas.get(token);
    if (r instanceof Error) throw r;
    const s = this.solicitudes[Number(token.replace("tok-", "")) - 1];
    return {
      aprobado: true,
      ordenCompra: s?.ordenCompra ?? "",
      sesionId: s?.sesionId ?? "",
      monto: s?.monto ?? 0,
      codigoAutorizacion: "1213",
      codigoRespuesta: 0,
      tipoTarjeta: "credito",
      ultimosDigitos: "6623",
      cuotas: 0,
      ...r
    };
  }
}
