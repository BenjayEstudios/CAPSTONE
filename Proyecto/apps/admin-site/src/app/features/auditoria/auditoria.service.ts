import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import {
  AuditoriaListadoRespuesta, FiltrosAuditoria, FiltrosAuditoriaOpciones, RegistroAuditoriaDetalle
} from "../../core/models/auditoria.models";

/** Omite filtros vacios; siempre envia pagina y tamano. */
export function construirParams(f: FiltrosAuditoria): HttpParams {
  let p = new HttpParams();
  for (const k of ["entidad", "accion", "usuarioId", "desde", "hasta"] as const) {
    const v = f[k]?.trim();
    if (v) p = p.set(k, v);
  }
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class AuditoriaService {
  private readonly api = inject(ApiClient);

  listar(filtros: FiltrosAuditoria) {
    return this.api.get<AuditoriaListadoRespuesta>(`/auditoria?${construirParams(filtros).toString()}`);
  }

  obtener(id: number) {
    return this.api.get<RegistroAuditoriaDetalle>(`/auditoria/${id}`);
  }

  filtros() {
    return this.api.get<FiltrosAuditoriaOpciones>("/auditoria/filtros");
  }
}
