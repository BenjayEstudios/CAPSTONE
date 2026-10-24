import { Routes } from "@angular/router";

export const MODERACION_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () => import("./moderacion-cola.component").then((c) => c.ModeracionColaComponent)
  }
];
