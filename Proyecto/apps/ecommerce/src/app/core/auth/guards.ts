import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "./auth.service";

// Rutas que exigen sesion (checkout, mis pedidos...). Sin sesion lleva a
// /ingresar y vuelve a la ruta pedida despues de entrar. El catalogo NO usa
// este guard: se navega sin cuenta (KAN-97).
export const sesionGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  if (await inject(AuthService).confirmarSesion()) return true;
  return router.createUrlTree(["/ingresar"], { queryParams: { returnUrl: state.url } });
};

// /ingresar y /registro: con sesion iniciada no tiene sentido verlas.
export const invitadoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).confirmarSesion()) ? router.createUrlTree(["/"]) : true;
};

/** Solo rutas internas como destino tras ingresar (evita redirecciones abiertas). */
export function destinoSeguro(url: string | null | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/ingresar") && !url.startsWith("/registro")
    ? url
    : "/";
}
