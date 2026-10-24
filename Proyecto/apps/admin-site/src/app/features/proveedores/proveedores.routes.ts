import { Routes } from "@angular/router";

export const PROVEEDORES_ROUTES: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./proveedores-list.component").then((c) => c.ProveedoresListComponent)
  },
  {
    path: ":id",
    data: { titulo: "Ficha de proveedor" },
    loadComponent: () => import("./proveedor-ficha.component").then((c) => c.ProveedorFichaComponent)
  }
];
