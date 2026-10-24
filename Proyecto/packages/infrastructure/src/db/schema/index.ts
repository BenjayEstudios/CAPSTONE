// Tablas de Drizzle (mysqlTable). Deben traducir el modelo DBML de
// ../../../../DataBase/dbDiagram.sql. "categoria" es el ejemplo de
// referencia; el resto (carro, orden...) se agrega siguiendo el mismo
// patron: un archivo <tabla>.schema.ts por tabla.
export * from "./categoria.schema.js";
export * from "./comuna.schema.js";
export * from "./direccion.schema.js";
export * from "./organizacion.schema.js";
export * from "./rol.schema.js";
export * from "./usuario.schema.js";
export * from "./producto.schema.js";
export * from "./oferta.schema.js";
export * from "./oferta-precio-historial.schema.js";
export * from "./moderacion-caso.schema.js";
export * from "./auditoria-log.schema.js";
