import { Routes } from "@angular/router";
import { StatusComponent } from "./features/status/status.component";

// Rutas por feature (cliente/pyme y distribuidor), cargadas con lazy
// loading y protegidas con guards de rol en core/auth. Ej:
//
// { path: "catalogo", loadChildren: () => import("./features/catalogo/catalogo.routes").then(m => m.CATALOGO_ROUTES) }
// { path: "panel-distribuidor", loadChildren: () => import("./features/panel-distribuidor/panel-distribuidor.routes").then(m => m.PANEL_DISTRIBUIDOR_ROUTES), canActivate: [distribuidorGuard] }
//
// "/" queda temporalmente en StatusComponent (verifica que el frontend
// levanto y que conecta con el backend) hasta que haya una vista real.
export const routes: Routes = [{ path: "", component: StatusComponent }];
