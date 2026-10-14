import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

// Wrapper delgado sobre HttpClient con la base URL de apps/backend. Los
// servicios de cada feature (ej. features/usuarios/usuarios.service.ts)
// se apoyan en este cliente en vez de armar la URL a mano.
@Injectable({ providedIn: "root" })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }
}
