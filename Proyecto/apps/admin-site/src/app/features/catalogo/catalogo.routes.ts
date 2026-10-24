import { Routes } from "@angular/router";

const ficha = () => import("./producto-ficha.component").then((c) => c.ProductoFichaComponent);

export const CATALOGO_ROUTES: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./catalogo-list.component").then((c) => c.CatalogoListComponent)
  },
  { path: "nuevo", data: { titulo: "Nuevo producto" }, loadComponent: ficha },
  { path: ":id", data: { titulo: "Ficha de producto" }, loadComponent: ficha }
];
