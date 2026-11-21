import { randomUUID } from "node:crypto";
import type { PagoIniciado, PasarelaPago, SolicitudPago, TransaccionPago } from "@cotizapp/domain";

// PasarelaPago simulada (KAN-164) para las pruebas end-to-end y demos sin
// Transbank: aprueba todo pago que ella misma inicio. La "pagina de pago" es
// la URL de retorno de nuestro backend, asi que el ecommerce, al enviar
// token_ws a urlPago, vuelve directo al retorno y la orden queda pagada; un
// cliente HTTP (Postman/Newman) puede llamar al retorno con el token.
//
// Las solicitudes viven en memoria del proceso: un token de antes de reiniciar
// el backend, o inventado, se responde como rechazado. El backend solo la usa
// con PASARELA=simulada, que env.ts prohibe en produccion.
export class PasarelaSimulada implements PasarelaPago {
  readonly nombre = "simulada";
  private readonly solicitudes = new Map<string, SolicitudPago>();

  async iniciar(s: SolicitudPago): Promise<PagoIniciado> {
    const token = `sim-${randomUUID()}`;
    this.solicitudes.set(token, s);
    return { token, url: s.urlRetorno };
  }

  async confirmar(token: string): Promise<TransaccionPago> {
    const s = this.solicitudes.get(token);
    this.solicitudes.delete(token);
    if (!s) {
      return { aprobado: false, ordenCompra: "", sesionId: "", monto: 0, codigoAutorizacion: null, codigoRespuesta: -1, tipoTarjeta: null, ultimosDigitos: null, cuotas: null };
    }
    return {
      aprobado: true,
      ordenCompra: s.ordenCompra,
      sesionId: s.sesionId,
      monto: s.monto,
      codigoAutorizacion: "SIM000",
      codigoRespuesta: 0,
      tipoTarjeta: "credito",
      ultimosDigitos: "6623",
      cuotas: 0
    };
  }
}
