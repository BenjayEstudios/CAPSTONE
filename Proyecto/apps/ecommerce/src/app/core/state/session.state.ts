import { Injectable, signal } from "@angular/core";

// Estado de sesión (usuario autenticado, rol activo: cliente | distribuidor
// | administrador). Los guards de rutas y el interceptor de auth leen de acá.
export type Rol = "cliente" | "distribuidor" | "administrador";

@Injectable({ providedIn: "root" })
export class SessionState {
  readonly rol = signal<Rol | null>(null);
}
