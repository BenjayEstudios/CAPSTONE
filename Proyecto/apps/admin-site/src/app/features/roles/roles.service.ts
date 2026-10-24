import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { MeResponse, NivelPermiso } from "../../core/models/auth.models";
import { ResultadoPermisos, RolesRespuesta } from "../../core/models/roles.models";

@Injectable({ providedIn: "root" })
export class RolesService {
  private readonly api = inject(ApiClient);

  listar() {
    return this.api.get<RolesRespuesta>("/roles");
  }

  actualizarPermisos(id: number, permisos: Record<string, NivelPermiso>) {
    return this.api.put<ResultadoPermisos>(`/roles/${id}/permisos`, { permisos });
  }

  /** Releer la sesion (permisos frescos) tras editar el rol del usuario actual. */
  sesionActual() {
    return this.api.get<MeResponse>("/auth/me");
  }
}
