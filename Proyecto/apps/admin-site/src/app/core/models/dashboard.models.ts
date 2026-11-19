export interface KpiDashboard {
  valor: number;
  anterior: number;
  /** Variacion % vs mes anterior; null si el mes anterior fue 0. */
  variacionPct: number | null;
}
export interface SemanaDashboard {
  inicio: string;
  fin: string;
  monto: number;
}
export interface ProveedorVolumen {
  proveedorId: number;
  nombre: string;
  skus: number;
  ordenes: number;
  monto: number;
}
export type ProblemaCatalogo = "sin_imagen" | "sin_ofertas" | "duplicada";
export interface DetalleSalud {
  productoId: number;
  producto: string;
  problema: ProblemaCatalogo;
}
export interface ResumenDashboard {
  mes: string;
  mesAnterior: string;
  kpis: {
    ordenes: KpiDashboard;
    montoTransado: KpiDashboard;
    comision: KpiDashboard;
    proveedoresActivos: KpiDashboard;
  };
  semanas: SemanaDashboard[];
  proveedoresPorVolumen: ProveedorVolumen[];
  saludCatalogo: { sinImagen: number; sinOfertas: number; duplicadas: number; detalle: DetalleSalud[] };
}
