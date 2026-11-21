import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { SessionState } from "../state/session.state";

// Rutas publicas de /auth: su 401 es "datos incorrectos", no "sesion vencida".
const RUTAS_PUBLICAS_AUTH = ["/auth/login", "/auth/registro/", "/auth/recuperar", "/auth/restablecer"];

// Agrega `Authorization: Bearer <token>` a las llamadas al backend. Un 401 en
// cualquier otra ruta significa que el JWT vencio o ya no vale: limpia la
// sesion y lleva a /ingresar, volviendo despues a donde estaba.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionState);
  const router = inject(Router);

  const esApi = req.url.startsWith(environment.apiUrl);
  const token = session.token();
  const request = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  const esAuthPublica = RUTAS_PUBLICAS_AUTH.some((r) => req.url.includes(r));

  return next(request).pipe(
    catchError((err: unknown) => {
      if (esApi && !esAuthPublica && err instanceof HttpErrorResponse && err.status === 401 && session.token()) {
        session.limpiar();
        const returnUrl = router.url && !router.url.startsWith("/ingresar") ? router.url : undefined;
        void router.navigate(["/ingresar"], { queryParams: { motivo: "expirada", returnUrl } });
      }
      return throwError(() => err);
    })
  );
};
