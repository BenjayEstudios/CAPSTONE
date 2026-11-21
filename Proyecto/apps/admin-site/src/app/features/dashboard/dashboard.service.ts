import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { EstadisticasPlataforma, ResumenDashboard } from "../../core/models/dashboard.models";

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly api = inject(ApiClient);

  resumen(mes?: string) {
    return this.api.get<ResumenDashboard>(`/dashboard/resumen${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`);
  }

  /** Trafico y demanda del rango [desde, hasta] (yyyy-mm-dd, inclusivos). */
  trafico(desde: string, hasta: string) {
    return this.api.get<EstadisticasPlataforma>(
      `/estadisticas/plataforma?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
    );
  }
}
