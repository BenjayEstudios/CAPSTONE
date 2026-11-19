import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AlmacenArchivos, ArchivoGuardado } from "@cotizapp/domain";

// Adaptador de disco local (desarrollo). Escribe bajo `directorio` y expone
// la URL publica `${urlBase}/uploads/<clave>`; el backend sirve ese
// directorio en /uploads con @fastify/static.
// Para produccion (DigitalOcean Spaces) se implementa otro AlmacenArchivos
// S3-compatible y se elige con STORAGE_DRIVER; el resto del codigo no cambia.
export class AlmacenLocal implements AlmacenArchivos {
  private readonly raiz: string;
  private readonly urlBase: string;

  constructor(opciones: { directorio: string; urlBase: string }) {
    this.raiz = path.resolve(opciones.directorio);
    this.urlBase = opciones.urlBase.replace(/\/+$/, "");
  }

  // Resuelve la clave dentro de la raiz; rechaza cualquier salida (../, absolutas).
  private rutaSegura(clave: string): string {
    const ruta = path.resolve(this.raiz, clave);
    if (clave === "" || !ruta.startsWith(this.raiz + path.sep)) throw new Error("Clave de archivo invalida");
    return ruta;
  }

  async guardar(contenido: Uint8Array, nombre: string, _mime: string): Promise<ArchivoGuardado> {
    const clave = nombre.split("\\").join("/");
    const ruta = this.rutaSegura(clave);
    await mkdir(path.dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
    return { clave, url: `${this.urlBase}/uploads/${clave}` };
  }

  async eliminar(clave: string): Promise<void> {
    await rm(this.rutaSegura(clave), { force: true });
  }
}
