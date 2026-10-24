import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { RUTA_INICIO } from "../navigation/modulos.config";
import { SessionState } from "../state/session.state";
import { AuthService } from "./auth.service";

// Solo entra quien tenga sesion valida de administrador. Al arrancar con un
// token guardado, espera a que GET /auth/me confirme la sesion.
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.restaurar()) return true;
  const queryParams = state.url && state.url !== "/" ? { returnUrl: state.url } : {};
  return router.createUrlTree(["/login"], { queryParams });
};

// /login: si ya hay sesion valida, redirige al inicio.
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.restaurar()) ? router.createUrlTree([RUTA_INICIO]) : true;
};

// Habilita una ruta segun el permiso asociado al modulo (parcial o total).
export const permisoGuard =
  (permiso: string): CanActivateFn =>
  () => {
    const session = inject(SessionState);
    const router = inject(Router);
    return session.tienePermiso(permiso) ? true : router.createUrlTree([RUTA_INICIO]);
  };
