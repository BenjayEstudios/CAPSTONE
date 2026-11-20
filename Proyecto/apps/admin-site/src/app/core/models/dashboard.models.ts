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
// GET /estadisticas/plataforma (KAN-154): eventos anonimos, sin sesion ni usuario.
export interface DiaTrafico {
  fecha: string;
  vistas: number;
  clicks: number;
  busquedas: number;
}
export interface EstadisticasPlataforma {
  desde: string;
  hasta: string;
  totales: { vistas: number; clicks: number; busquedas: number };
  /** clicks / vistas, entre 0 y 1 (0 si no hay vistas). */
  conversionVistaClick: number;
  porDia: DiaTrafico[];
  productosMasVistos: Array<{ productoId: number; nombre: string; vistas: number }>;
  terminosMasBuscados: Array<{ termino: string; busquedas: number }>;
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
