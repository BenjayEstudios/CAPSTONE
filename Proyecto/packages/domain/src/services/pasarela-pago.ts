// Puerto de la pasarela de pago (KAN-95, KAN-148). Adaptadores en
// @cotizapp/infrastructure: WebpayPlus (Transbank, REST v1.2) y
// PasarelaEnMemoria (tests). El reparto entre proveedores no pasa por la
// pasarela: se cobra una vez y se liquida en nuestra base (liquidacion).

export interface SolicitudPago {
  /** Orden de compra visible en la pasarela: el folio de la orden (CM-90012). */
  ordenCompra: string;
  /** Identificador de sesion propio (se devuelve tal cual al confirmar). */
  sesionId: string;
  /** Monto entero en CLP. */
  monto: number;
  /** URL a la que la pasarela devuelve al comprador (nuestro backend). */
  urlRetorno: string;
}

export interface PagoIniciado {
  /** Token de la transaccion: se guarda en orden.referencia_pasarela. */
  token: string;
  /** Formulario de la pasarela al que se envia el token. */
  url: string;
}

export type TipoTarjeta = "credito" | "debito" | "prepago";

export interface TransaccionPago {
  aprobado: boolean;
  ordenCompra: string;
  sesionId: string;
  monto: number;
  codigoAutorizacion: string | null;
  /** Codigo de respuesta de la pasarela (Webpay: 0 = aprobado). */
  codigoRespuesta: number | null;
  tipoTarjeta: TipoTarjeta | null;
  ultimosDigitos: string | null;
  cuotas: number | null;
}

export interface PasarelaPago {
  /** Nombre corto para la auditoria ("webpay"). */
  readonly nombre: string;
  iniciar(solicitud: SolicitudPago): Promise<PagoIniciado>;
  /**
   * Confirma (Webpay: commit) la transaccion cuando el comprador vuelve. Un
   * rechazo de la tarjeta no lanza: devuelve aprobado = false. Lanza solo si
   * la pasarela no responde o el token no existe.
   */
  confirmar(token: string): Promise<TransaccionPago>;
}
