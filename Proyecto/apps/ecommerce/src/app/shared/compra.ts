// Reglas de compra que comparten la ficha y el carro. Son las mismas que
// valida el backend al confirmar (planificarOrden en carro.use-cases.ts):
// la cantidad va en cajas y el minimo de compra en unidades.

export interface DatosMinimo {
  minimoCompra: number | null;
  unidadesPorCaja: number | null;
}

/** Cajas que hay que pedir para cumplir el minimo de compra (en unidades); al menos 1. */
export function cajasMinimas(o: DatosMinimo): number {
  if (!o.minimoCompra) return 1;
  return Math.max(1, Math.ceil(o.minimoCompra / (o.unidadesPorCaja ?? 1)));
}

/** "1 caja" / "3 cajas". */
export function cajas(n: number): string {
  return `${n} ${n === 1 ? "caja" : "cajas"}`;
}
