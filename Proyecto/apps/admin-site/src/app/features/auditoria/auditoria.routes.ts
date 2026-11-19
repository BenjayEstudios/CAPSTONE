import { Routes } from "@angular/router";

export const AUDITORIA_ROUTES: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./auditoria-list.component").then((c) => c.AuditoriaListComponent)
  }
];
