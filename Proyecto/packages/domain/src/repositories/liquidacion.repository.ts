import type { Liquidacion, LiquidacionEstado } from "../entities/liquidacion.entity.js";
import type { OrdenEnvio } from "../entities/orden-envio.entity.js";

export interface LiquidacionConProveedor extends Liquidacion {
  proveedorNombre: string;
}

export interface EnvioLiquidado {
  envioId: number;
  ordenId: number;
  ordenCodigo: string;
  entregadoEn: Date;
  montoBruto: number;
  comision: number;
  montoNeto: number;
}

export interface FiltrosLiquidaciones {
  proveedorId?: number;
  estado?: LiquidacionEstado;
  /** Periodo contenido en [desde, hasta] (YYYY-MM-DD). */
  desde?: string;
  hasta?: string;
  pagina: number;
  tamano: number;
}

/** Rango de cierre de envios: [desde, hasta) como instantes; periodo* son las fechas locales (Chile) del corte. */
export interface RangoLiquidacion {
  desde: Date;
  hasta: Date;
  periodoDesde: string;
  periodoHasta: string;
}

export interface CalculoLiquidacion {
  montoBruto: number;
  comision: number;
  montoNeto: number;
  envios: Array<{ envioId: number; montoBruto: number; comision: number; montoNeto: number }>;
}

export type ResultadoPago = { resultado: "ok"; liquidacion: Liquidacion } | { resultado: "no_existe" } | { resultado: "ya_pagada" };

export interface LiquidacionRepository {
  /** Proveedores con envios entregados, sin liquidar, cuyo cierre cae en el rango. */
  proveedoresConPendientes(rango: RangoLiquidacion): Promise<number[]>;
  /**
   * UNA transaccion: bloquea los envios entregados sin liquidar del proveedor dentro del rango, calcula,
   * inserta la liquidacion, llena los montos liquidados en cada envio y registra auditoria.
   * null si no habia nada que liquidar.
   */
  liquidarProveedor(
    proveedorId: number,
    rango: RangoLiquidacion,
    calcular: (envios: OrdenEnvio[]) => CalculoLiquidacion,
    actorId: number | null
  ): Promise<Liquidacion | null>;
  listar(f: FiltrosLiquidaciones): Promise<{ items: LiquidacionConProveedor[]; total: number }>;
  buscarPorId(id: number): Promise<{ liquidacion: LiquidacionConProveedor; envios: EnvioLiquidado[] } | null>;
  /** Transaccion con bloqueo: marca pagada + auditoria. */
  marcarPagada(id: number, pagadaEn: Date, actorId: number): Promise<ResultadoPago>;
}
