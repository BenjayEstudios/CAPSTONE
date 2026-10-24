// Casos de uso: funciones puras que reciben sus dependencias (repositorios,
// servicios de dominio) como parámetros explícitos — sin service-locator ni
// contenedor de DI. "categoria" (listar/crear) es el ejemplo de referencia;
// el resto (agregarAlCarro, checkoutOrden...) se agrega siguiendo el mismo
// patron.
export * from "./listar-categorias.use-case.js";
export * from "./crear-categoria.use-case.js";
export * from "./login-admin.use-case.js";
export * from "./obtener-sesion-usuario.use-case.js";
export * from "./actualizar-categoria.use-case.js";
export * from "./listar-productos.use-case.js";
export * from "./obtener-producto.use-case.js";
export * from "./crear-producto.use-case.js";
export * from "./actualizar-producto.use-case.js";
export * from "./reemplazar-imagenes-producto.use-case.js";
export * from "./verificar-permisos.use-case.js";
export * from "./subir-imagen-producto.use-case.js";
export * from "./listar-proveedores.use-case.js";
export * from "./obtener-proveedor.use-case.js";
export * from "./revisar-documento-proveedor.use-case.js";
export * from "./cambiar-estado-proveedor.use-case.js";
