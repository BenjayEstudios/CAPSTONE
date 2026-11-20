import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import {
  ActualizarUsuarioBody, CrearUsuarioBody, CrearUsuarioRespuesta, FiltrosUsuarios, OpcionesUsuario, OrganizacionOpcion, UsuarioItem, UsuariosRespuesta
} from "../../core/models/usuarios.models";

export function construirParams(f: FiltrosUsuarios): HttpParams {
  let p = new HttpParams();
  if (f.rolId) p = p.set("rolId", f.rolId);
  if (f.organizacionId) p = p.set("organizacionId", f.organizacionId);
  if (f.estado) p = p.set("estado", f.estado);
  const q = f.q?.trim();
  if (q) p = p.set("q", q);
  if (f.orden && f.orden !== "reciente") p = p.set("orden", f.orden);
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class UsuariosService {
  private readonly api = inject(ApiClient);

  listar(f: FiltrosUsuarios) {
    return this.api.get<UsuariosRespuesta>(`/usuarios?${construirParams(f).toString()}`);
  }
  opciones() {
    return this.api.get<OpcionesUsuario>("/usuarios/opciones");
  }
  /** Typeahead: nunca trae todas las organizaciones, solo las primeras coincidencias (o una por id). */
  buscarOrganizaciones(f: { q?: string; id?: string }) {
    let p = new HttpParams();
    const q = f.q?.trim();
    if (f.id) p = p.set("id", f.id);
    else if (q) p = p.set("q", q);
    return this.api.get<{ items: OrganizacionOpcion[] }>(`/usuarios/organizaciones?${p.toString()}`);
  }
  crear(body: CrearUsuarioBody) {
    return this.api.post<CrearUsuarioRespuesta>("/usuarios", body);
  }
  actualizar(id: number, body: ActualizarUsuarioBody) {
    return this.api.patch<UsuarioItem>(`/usuarios/${id}`, body);
  }
  suspender(id: number) {
    return this.api.post<UsuarioItem>(`/usuarios/${id}/suspender`, {});
  }
  reactivar(id: number) {
    return this.api.post<UsuarioItem>(`/usuarios/${id}/reactivar`, {});
  }
}
