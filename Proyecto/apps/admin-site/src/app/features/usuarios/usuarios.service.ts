import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import {
  ActualizarUsuarioBody, CrearUsuarioBody, CrearUsuarioRespuesta, FiltrosUsuarios, OpcionesUsuario, UsuarioItem, UsuariosRespuesta
} from "../../core/models/usuarios.models";

export function construirParams(f: FiltrosUsuarios): HttpParams {
  let p = new HttpParams();
  if (f.rolId) p = p.set("rolId", f.rolId);
  if (f.organizacionId) p = p.set("organizacionId", f.organizacionId);
  if (f.estado) p = p.set("estado", f.estado);
  const q = f.q?.trim();
  if (q) p = p.set("q", q);
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
