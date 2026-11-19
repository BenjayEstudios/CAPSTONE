import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { ResumenDashboard } from "../../core/models/dashboard.models";

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly api = inject(ApiClient);

  resumen(mes?: string) {
    return this.api.get<ResumenDashboard>(`/dashboard/resumen${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`);
  }
}
