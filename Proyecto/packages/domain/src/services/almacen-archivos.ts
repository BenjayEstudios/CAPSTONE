// Puerto de almacenamiento de archivos (imagenes de producto, etc.).
// Implementaciones en @cotizapp/infrastructure: AlmacenLocal (disco, dev) y,
// en produccion, un adaptador S3-compatible para DigitalOcean Spaces (punto
// de extension, aun no implementado; ver apps/backend/README.md).
export interface ArchivoGuardado {
  url: string; // URL publica desde la que se sirve el archivo
  clave: string; // identificador interno estable (ruta relativa / key del bucket)
}

export interface AlmacenArchivos {
  // `nombre` lo genera el servidor (nunca el cliente); el adaptador puede
  // anteponer prefijos de carpeta. `mime` es el detectado por firma binaria.
  guardar(contenido: Uint8Array, nombre: string, mime: string): Promise<ArchivoGuardado>;
  eliminar(clave: string): Promise<void>;
}
