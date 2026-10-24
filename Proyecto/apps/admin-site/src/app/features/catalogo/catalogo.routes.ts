import { Routes } from "@angular/router";

const enConstruccion = () =>
  import("../en-construccion/en-construccion.component").then((c) => c.EnConstruccionComponent);

// "nuevo" y ":id" apuntan al placeholder hasta implementar la ficha.
export const CATALOGO_ROUTES: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./catalogo-list.component").then((c) => c.CatalogoListComponent)
  },
  { path: "nuevo", data: { titulo: "Nuevo producto" }, loadComponent: enConstruccion },
  { path: ":id", data: { titulo: "Ficha de producto" }, loadComponent: enConstruccion }
];
