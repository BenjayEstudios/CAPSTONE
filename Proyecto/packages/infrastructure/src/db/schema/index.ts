// Tablas de Drizzle (mysqlTable). Traducen el modelo DBML de
// ../../../../DataBase/dbDiagram.sql, un archivo <tabla>.schema.ts por tabla.
// 5.1 Identidad y permisos
export * from "./rol.schema.js";
export * from "./organizacion.schema.js";
export * from "./usuario.schema.js";
// 5.2 Geografia
export * from "./comuna.schema.js";
export * from "./direccion.schema.js";
// 5.3 Catalogo maestro
export * from "./categoria.schema.js";
export * from "./producto.schema.js";
// 5.4 Proveedores
export * from "./punto-retiro.schema.js";
export * from "./proveedor-cobertura.schema.js";
export * from "./proveedor-documento.schema.js";
// 5.5 Ofertas
export * from "./oferta.schema.js";
export * from "./oferta-precio-historial.schema.js";
// 5.6 Carro y ordenes
export * from "./carro.schema.js";
export * from "./orden.schema.js";
export * from "./orden-envio.schema.js";
export * from "./orden-linea.schema.js";
export * from "./calificacion.schema.js";
// 5.7 SII y liquidaciones
export * from "./documento-tributario.schema.js";
export * from "./liquidacion.schema.js";
// 5.8 Analitica
export * from "./evento-analitico.schema.js";
// 5.9 Auditoria
export * from "./auditoria-log.schema.js";
export * from "./moderacion-caso.schema.js";
