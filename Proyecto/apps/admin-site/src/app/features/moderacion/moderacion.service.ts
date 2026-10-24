import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { Caso, CasoDetalle, CasosRespuesta, FiltrosCasos, UsuarioInterno } from "../../core/models/moderacion.models";

export function construirParams(f: FiltrosCasos): HttpParams {
  let p = new HttpParams();
  if (f.tipo) p = p.set("tipo", f.tipo);
  if (f.estado) p = p.set("estado", f.estado);
  if (f.asignadoA !== undefined && f.asignadoA !== "") p = p.set("asignadoA", String(f.asignadoA));
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class ModeracionService {
  private readonly api = inject(ApiClient);

  listar(f: FiltrosCasos) {
    return this.api.get<CasosRespuesta>(`/moderacion/casos?${construirParams(f).toString()}`);
  }
  obtener(id: number) {
    return this.api.get<CasoDetalle>(`/moderacion/casos/${id}`);
  }
  usuariosInternos() {
    return this.api.get<{ items: UsuarioInterno[] }>("/moderacion/usuarios-internos");
  }
  asignar(id: number, usuarioId: number | null) {
    return this.api.post<Caso>(`/moderacion/casos/${id}/asignar`, { usuarioId });
  }
  resolver(id: number, nota: string) {
    return this.api.post<Caso>(`/moderacion/casos/${id}/resolver`, { nota: nota.trim() });
  }
  descartar(id: number, motivo: string) {
    return this.api.post<Caso>(`/moderacion/casos/${id}/descartar`, { motivo: motivo.trim() });
  }
}
