// Tablas de Drizzle (mysqlTable). Traducen 1:1 el modelo DBML de
// ../../../../DataBase/dbDiagram.sql: un archivo <tabla>.schema.ts por tabla.
// Estan todas las tablas del DBML (incluye carro, orden, orden_envio,
// orden_linea, liquidacion, documento_tributario y evento_analitico).
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
export * from "./proveedor-documento.schema.js";
export * from "./proveedor-cobertura.schema.js";
export * from "./punto-retiro.schema.js";
export * from "./carro.schema.js";
export * from "./orden.schema.js";
export * from "./liquidacion.schema.js";
export * from "./orden-envio.schema.js";
export * from "./orden-linea.schema.js";
export * from "./documento-tributario.schema.js";
export * from "./evento-analitico.schema.js";
