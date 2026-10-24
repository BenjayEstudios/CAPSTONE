import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CorreoSaliente, ServicioCorreo } from "@cotizapp/domain";

export interface OpcionesCorreoConsola {
  /** Si se indica, el cuerpo de cada correo se escribe en este directorio (solo dev). */
  directorioSalida?: string;
  log?: (mensaje: string) => void;
}

// Adaptador de desarrollo: no envia nada. Registra destinatario y asunto en el
// log SIN el cuerpo (puede contener claves temporales). Para ver el cuerpo en
// dev, configurar `directorioSalida` (MAIL_OUT_DIR): escribe un .txt por correo.
export class CorreoConsola implements ServicioCorreo {
  constructor(private readonly opciones: OpcionesCorreoConsola = {}) {}

  async enviar(correo: CorreoSaliente): Promise<void> {
    const log = this.opciones.log ?? ((m: string) => console.log(m));
    log(`[correo:consola] para=${correo.para} asunto="${correo.asunto}"`);
    const dir = this.opciones.directorioSalida;
    if (dir) {
      await mkdir(dir, { recursive: true });
      const seguro = correo.para.replace(/[^a-zA-Z0-9@._-]/g, "_");
      const archivo = path.join(dir, `${Date.now()}-${seguro}.txt`);
      await writeFile(archivo, `Para: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n`, "utf8");
      log(`[correo:consola] cuerpo escrito en ${archivo}`);
    }
  }
}
