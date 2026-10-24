// Puerto de correo transaccional. Adaptadores en @cotizapp/infrastructure:
// CorreoConsola (dev), CorreoSmtp (nodemailer) y CorreoEnMemoria (tests).
export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
}

export interface ServicioCorreo {
  /** Lanza si el envio falla; quien llama decide si es fatal. */
  enviar(correo: CorreoSaliente): Promise<void>;
}
