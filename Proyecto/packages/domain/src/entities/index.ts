// Entidades de dominio (clases/tipos puros, sin dependencias externas).
// Ver DataBase/dbDiagram.sql para el modelo completo. "categoria" es el
// ejemplo de referencia; el resto (Organizacion, Usuario, Producto, Oferta,
// Carro, Orden, Liquidacion...) se agrega siguiendo el mismo patron.
export * from "./categoria.entity.js";
export * from "./organizacion.entity.js";
export * from "./rol.entity.js";
export * from "./usuario.entity.js";
export * from "./producto.entity.js";
export * from "./proveedor.entity.js";
export * from "./proveedor-documento.entity.js";
export * from "./auditoria.entity.js";
