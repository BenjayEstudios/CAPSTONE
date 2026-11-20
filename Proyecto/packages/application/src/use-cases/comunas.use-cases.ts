import type { ComunaRepository } from "@cotizapp/domain";

// GET /comunas (KAN-95): publico, para escribir una direccion nueva en el checkout.
export function listarComunas(deps: { comunaRepository: ComunaRepository }) {
  return () => deps.comunaRepository.listar();
}
