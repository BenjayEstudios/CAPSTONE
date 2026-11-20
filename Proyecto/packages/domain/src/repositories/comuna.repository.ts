// Comunas con su region (GET /comunas, KAN-95): para escribir una direccion nueva en el checkout.
export interface ComunaConRegion {
  id: number;
  nombre: string;
  regionCodigo: string;
  regionNombre: string;
}

export interface ComunaRepository {
  /** Ordenadas por region (orden norte a sur) y nombre. */
  listar(): Promise<ComunaConRegion[]>;
}
