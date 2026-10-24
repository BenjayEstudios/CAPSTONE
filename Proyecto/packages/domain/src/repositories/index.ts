// Interfaces de repositorio (puertos) que implementará @cotizapp/infrastructure.
// "categoria" es el ejemplo de referencia; el resto (OrdenRepository,
// ProductoRepository...) se agrega siguiendo el mismo patron.
export * from "./categoria.repository.js";
export * from "./usuario.repository.js";
export * from "./producto.repository.js";
export * from "./proveedor.repository.js";
export * from "./rol.repository.js";
export * from "./auditoria.repository.js";
