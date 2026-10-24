import { Component, inject, signal } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";

interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

// Vista temporal de verificacion: confirma que el frontend levanto y que
// llega al backend (GET /health-check). Reemplazar por las vistas reales
// de cada feature cuando esten listas.
@Component({
  selector: "app-status",
  standalone: true,
  templateUrl: "./status.component.html",
  styleUrl: "./status.component.css"
})
export class StatusComponent {
  private readonly api = inject(ApiClient);

  readonly state = signal<"loading" | "ok" | "error">("loading");
  readonly response = signal<HealthCheckResponse | null>(null);

  constructor() {
    this.api.get<HealthCheckResponse>("/health-check").subscribe({
      next: (data) => {
        this.response.set(data);
        this.state.set("ok");
      },
      error: () => this.state.set("error")
    });
  }
}
