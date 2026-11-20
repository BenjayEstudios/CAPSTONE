import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";

// Wrapper delgado sobre HttpClient con la base URL de apps/backend. Los
// servicios de cada feature se apoyan en este cliente en vez de armar la URL
// a mano. El token lo agrega core/auth/auth.interceptor.ts.
@Injectable({ providedIn: "root" })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }
}
