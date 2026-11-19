import type { ServicioCorreo } from "@cotizapp/domain";
import { CorreoConsola, CorreoSmtp } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";
import { logger } from "./logger.js";

// Selector del adaptador de ServicioCorreo segun MAIL_DRIVER. Las credenciales
// SMTP salen solo del entorno. En consola, el cuerpo (puede traer claves
// temporales) jamas va al log; solo se escribe a MAIL_OUT_DIR si esta definido.
export function crearServicioCorreo(
  env: Pick<Env, "MAIL_DRIVER" | "MAIL_OUT_DIR" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM">
): ServicioCorreo {
  switch (env.MAIL_DRIVER) {
    case "smtp":
      return new CorreoSmtp({
        host: env.SMTP_HOST as string,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM as string
      });
    case "consola":
      return new CorreoConsola({ directorioSalida: env.MAIL_OUT_DIR || undefined, log: (m) => logger.info(m) });
  }
}
