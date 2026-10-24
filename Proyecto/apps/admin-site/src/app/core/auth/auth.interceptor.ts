import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { SessionState } from "../state/session.state";

const RUTA_LOGIN_API = "/auth/admin/login";

// Agrega `Authorization: Bearer <token>` a las llamadas al backend. Ante un
// 401 (sesion expirada/invalida) limpia la sesion y redirige a /login. El 401
// del propio login (credenciales invalidas) no redirige: lo maneja la pagina.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionState);
  const router = inject(Router);

  const esApi = req.url.startsWith(environment.apiUrl);
  const token = session.token();
  const request = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (esApi && err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith(RUTA_LOGIN_API)) {
        session.limpiar();
        void router.navigate(["/login"], { queryParams: { motivo: "expirada" } });
      }
      return throwError(() => err);
    })
  );
};
