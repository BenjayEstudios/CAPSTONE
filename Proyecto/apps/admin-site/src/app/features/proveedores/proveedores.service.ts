import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { map } from "rxjs";
import { ApiClient } from "../../core/api/api.client";
import {
  DocumentoProveedor, FiltrosProveedores, ProveedorFicha, ProveedorListadoRespuesta, ResultadoEstado
} from "../../core/models/proveedores.models";
import { normalizarFicha, normalizarItem, normalizarResultado } from "./proveedores.util";

export function construirParams(f: FiltrosProveedores): HttpParams {
  let p = new HttpParams();
  if (f.estado) p = p.set("estado", f.estado);
  const q = f.q?.trim();
  if (q) p = p.set("q", q);
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class ProveedoresService {
  private readonly api = inject(ApiClient);

  listar(filtros: FiltrosProveedores) {
    return this.api
      .get<ProveedorListadoRespuesta>(`/proveedores?${construirParams(filtros).toString()}`)
      .pipe(map((r) => ({ ...r, items: r.items.map(normalizarItem) })));
  }

  obtener(id: string) {
    return this.api.get<ProveedorFicha>(`/proveedores/${id}`).pipe(map(normalizarFicha));
  }

  revisarDocumento(id: string, documentoId: string, decision: "aprobado" | "rechazado", motivo?: string) {
    const body = decision === "rechazado" ? { decision, motivo } : { decision };
    return this.api.patch<DocumentoProveedor>(`/proveedores/${id}/documentos/${documentoId}/revision`, body);
  }

  aprobar(id: string, comisionPct?: number | null) {
    const body = comisionPct === null || comisionPct === undefined ? {} : { comisionPct };
    return this.api.post<ResultadoEstado>(`/proveedores/${id}/aprobar`, body).pipe(map(normalizarResultado));
  }

  rechazar(id: string, motivo: string) {
    return this.api.post<ResultadoEstado>(`/proveedores/${id}/rechazar`, { motivo }).pipe(map(normalizarResultado));
  }

  suspender(id: string, motivo: string) {
    return this.api.post<ResultadoEstado>(`/proveedores/${id}/suspender`, { motivo }).pipe(map(normalizarResultado));
  }
}
