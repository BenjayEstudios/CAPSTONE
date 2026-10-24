import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import {
  FiltrosLiquidaciones, Liquidacion, LiquidacionDetalle, LiquidacionesRespuesta, ResultadoGeneracion
} from "../../core/models/liquidaciones.models";

export function construirParams(f: FiltrosLiquidaciones): HttpParams {
  let p = new HttpParams();
  if (f.proveedorId !== undefined && f.proveedorId !== "") p = p.set("proveedorId", String(f.proveedorId));
  if (f.estado) p = p.set("estado", f.estado);
  if (f.desde) p = p.set("desde", f.desde);
  if (f.hasta) p = p.set("hasta", f.hasta);
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class LiquidacionesService {
  private readonly api = inject(ApiClient);

  listar(f: FiltrosLiquidaciones) {
    return this.api.get<LiquidacionesRespuesta>(`/liquidaciones?${construirParams(f).toString()}`);
  }
  obtener(id: number) {
    return this.api.get<LiquidacionDetalle>(`/liquidaciones/${id}`);
  }
  pagar(id: number, fechaPago: string) {
    return this.api.post<Liquidacion>(`/liquidaciones/${id}/pagar`, { fechaPago });
  }
  generar(desde: string, hasta: string) {
    return this.api.post<ResultadoGeneracion>("/liquidaciones/generar", { desde, hasta });
  }
}
