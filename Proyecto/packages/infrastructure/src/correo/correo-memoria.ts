import type { CorreoSaliente, ServicioCorreo } from "@cotizapp/domain";

// Adaptador en memoria para tests: acumula los correos enviados.
export class CorreoEnMemoria implements ServicioCorreo {
  readonly enviados: CorreoSaliente[] = [];
  falla = false;

  async enviar(correo: CorreoSaliente): Promise<void> {
    if (this.falla) throw new Error("fallo simulado de envio");
    this.enviados.push(correo);
  }
}
