// Casos de uso: funciones puras que reciben sus dependencias (repositorios,
// servicios de dominio) como parámetros explícitos — sin service-locator ni
// contenedor de DI. "categoria" (listar/crear) es el ejemplo de referencia;
// el resto (agregarAlCarro, checkoutOrden...) se agrega siguiendo el mismo
// patron.
export * from "./listar-categorias.use-case.js";
export * from "./crear-categoria.use-case.js";
