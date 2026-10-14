import { Routes } from "@angular/router";
import { StatusComponent } from "./features/status/status.component";

// Rutas por feature de administración, cargadas con lazy loading y
// protegidas con guards de rol (solo administrador) en core/auth. Ej:
//
// { path: "usuarios", loadChildren: () => import("./features/usuarios/usuarios.routes").then(m => m.USUARIOS_ROUTES) }
// { path: "moderacion", loadChildren: () => import("./features/moderacion/moderacion.routes").then(m => m.MODERACION_ROUTES) }
//
// "/" queda temporalmente en StatusComponent (verifica que el frontend
// levanto y que conecta con el backend) hasta que haya una vista real.
export const routes: Routes = [{ path: "", component: StatusComponent }];
