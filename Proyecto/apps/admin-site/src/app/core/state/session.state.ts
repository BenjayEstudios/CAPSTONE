import { Injectable, signal } from "@angular/core";

// Estado de sesión del administrador autenticado. El guard de rutas y el
// interceptor de auth leen de acá.
@Injectable({ providedIn: "root" })
export class SessionState {
  readonly autenticado = signal(false);
}
