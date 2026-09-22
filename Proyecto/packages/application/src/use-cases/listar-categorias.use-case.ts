import type { CategoriaRepository } from "@cotizapp/domain";

// Caso de uso: funcion pura que recibe sus dependencias explicitas (aca,
// el repositorio) y devuelve otra funcion con la operacion en si. Nada de
// service-locator ni contenedor de DI: quien arma el caso de uso decide
// que implementacion de CategoriaRepository le pasa (composition root en
// apps/rest/src/server/app.ts).
export function listarCategorias(deps: { categoriaRepository: CategoriaRepository }) {
  return async () => {
    return deps.categoriaRepository.listar();
  };
}
