// Puerto del dashboard de la plataforma (KAN-113): solo lectura, agregaciones.
// "Orden contada" = estado_pago 'pagado' y estado distinto de 'reembolsada'.
export interface RangoMes {
  desde: Date;
  hastaExclusivo: Date;
}
export interface TotalesMes {
  ordenes: number;
  monto: number;
  comision: number;
  proveedoresActivos: number;
}
export interface MontoDia {
  fecha: string; // yyyy-mm-dd
  monto: number;
}
export interface ProveedorVolumen {
  proveedorId: number;
  nombre: string;
  skus: number;
  ordenes: number;
  monto: number;
}
export interface ProductoSalud {
  id: number;
  nombre: string;
  ean: string | null;
  formato: string | null;
}
export interface MuestraSalud {
  total: number;
  items: ProductoSalud[];
}

export interface DashboardRepository {
  totalesMes(r: RangoMes): Promise<TotalesMes>;
  montoPorDia(r: RangoMes): Promise<MontoDia[]>;
  proveedoresPorVolumen(r: RangoMes, limite: number): Promise<ProveedorVolumen[]>;
  /** Productos publicados sin imagenes (total + muestra de hasta `limite`). */
  productosSinImagen(limite: number): Promise<MuestraSalud>;
  /** Productos publicados sin ninguna oferta publicada. */
  productosSinOfertas(limite: number): Promise<MuestraSalud>;
  /** Productos no archivados, para detectar duplicados en la capa de aplicacion. */
  productosParaDuplicados(): Promise<ProductoSalud[]>;
}
