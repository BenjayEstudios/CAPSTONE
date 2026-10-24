import { Routes } from "@angular/router";
import { adminGuard, guestGuard, permisoGuard } from "./core/auth/guards";
import { BRAND } from "./core/config/brand";
import { MODULOS } from "./core/navigation/modulos.config";

// Cada modulo del sidebar (core/navigation/modulos.config.ts) tiene su ruta
// lazy. Por ahora todas cargan el placeholder "En construccion"; al
// implementar un feature, reemplazar su `loadComponent` por un
// `loadChildren` hacia features/<modulo>/<modulo>.routes.ts.
const RUTAS_PROPIAS = ["catalogo-maestro", "categorias"];

export const routes: Routes = [
  {
    path: "login",
    title: `Ingresar · ${BRAND.nombre}`,
    canActivate: [guestGuard],
    loadComponent: () => import("./features/login/login.component").then((m) => m.LoginComponent)
  },
  {
    path: "",
    canActivate: [adminGuard],
    loadComponent: () => import("./features/shell/shell.component").then((m) => m.ShellComponent),
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      {
        path: "catalogo-maestro",
        title: `Catálogo maestro · ${BRAND.nombre}`,
        canActivate: [permisoGuard("crear_producto")],
        loadChildren: () => import("./features/catalogo/catalogo.routes").then((m) => m.CATALOGO_ROUTES)
      },
      {
        path: "categorias",
        title: `Categorías · ${BRAND.nombre}`,
        canActivate: [permisoGuard("crear_producto")],
        loadChildren: () => import("./features/categorias/categorias.routes").then((m) => m.CATEGORIAS_ROUTES)
      },
      // catalogo-maestro y categorias ya tienen rutas reales arriba.
      ...MODULOS.filter((m) => !RUTAS_PROPIAS.includes(m.path)).map((m) => ({
        path: m.path,
        title: `${m.label} · ${BRAND.nombre}`,
        data: { titulo: m.label },
        canActivate: m.permiso ? [permisoGuard(m.permiso)] : [],
        loadComponent: () =>
          import("./features/en-construccion/en-construccion.component").then((c) => c.EnConstruccionComponent)
      }))
    ]
  },
  { path: "**", redirectTo: "" }
];
