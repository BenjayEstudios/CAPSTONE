import { Routes } from "@angular/router";

export const REEMBOLSOS_ROUTES: Routes = [
  { path: "", loadComponent: () => import("./reembolsos.component").then((c) => c.ReembolsosComponent) }
];
