import nodemailer, { type Transporter } from "nodemailer";
import type { CorreoSaliente, ServicioCorreo } from "@cotizapp/domain";

export interface ConfigSmtp {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
}

// Adaptador SMTP (nodemailer). Las credenciales vienen del entorno, nunca del repo.
export class CorreoSmtp implements ServicioCorreo {
  private readonly transporte: Transporter;

  constructor(private readonly config: ConfigSmtp) {
    this.transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined
    });
  }

  async enviar(correo: CorreoSaliente): Promise<void> {
    await this.transporte.sendMail({
      from: this.config.from,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html
    });
  }
}
