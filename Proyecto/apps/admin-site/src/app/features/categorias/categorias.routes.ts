import { Routes } from "@angular/router";

export const CATEGORIAS_ROUTES: Routes = [
  { path: "", loadComponent: () => import("./categorias.component").then((m) => m.CategoriasComponent) }
];
