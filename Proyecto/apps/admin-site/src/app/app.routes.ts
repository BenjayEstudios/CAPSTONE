import { Routes } from "@angular/router";
import { sesionInternaGuard, guestGuard, permisoGuard } from "./core/auth/guards";
import { BRAND } from "./core/config/brand";
import { MODULOS } from "./core/navigation/modulos.config";

// Cada modulo del sidebar (core/navigation/modulos.config.ts) tiene su ruta
// lazy. Por ahora todas cargan el placeholder "En construccion"; al
// implementar un feature, reemplazar su `loadComponent` por un
// `loadChildren` hacia features/<modulo>/<modulo>.routes.ts.
const RUTAS_PROPIAS = ["catalogo-maestro", "categorias", "proveedores", "roles-permisos", "auditoria", "moderacion", "usuarios", "ordenes", "liquidaciones", "dashboard", "reembolsos"];

export const routes: Routes = [
  {
    path: "login",
    title: `Ingresar · ${BRAND.nombre}`,
    canActivate: [guestGuard],
    loadComponent: () => import("./features/login/login.component").then((m) => m.LoginComponent)
  },
  {
    path: "",
    canActivate: [sesionInternaGuard],
    loadComponent: () => import("./features/shell/shell.component").then((m) => m.ShellComponent),
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      {
        path: "dashboard",
        title: `Dashboard · ${BRAND.nombre}`,
        loadChildren: () => import("./features/dashboard/dashboard.routes").then((m) => m.DASHBOARD_ROUTES)
      },
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
      {
        path: "proveedores",
        title: `Proveedores · ${BRAND.nombre}`,
        canActivate: [permisoGuard("aprobar_proveedor")],
        loadChildren: () => import("./features/proveedores/proveedores.routes").then((m) => m.PROVEEDORES_ROUTES)
      },
      {
        path: "roles-permisos",
        title: `Roles y permisos · ${BRAND.nombre}`,
        canActivate: [permisoGuard("cambiar_permisos")],
        loadChildren: () => import("./features/roles/roles.routes").then((m) => m.ROLES_ROUTES)
      },
      {
        path: "auditoria",
        title: `Auditoría · ${BRAND.nombre}`,
        canActivate: [permisoGuard("ver_auditoria")],
        loadChildren: () => import("./features/auditoria/auditoria.routes").then((m) => m.AUDITORIA_ROUTES)
      },
      {
        path: "moderacion",
        title: `Moderación · ${BRAND.nombre}`,
        canActivate: [permisoGuard("aprobar_proveedor")],
        loadChildren: () => import("./features/moderacion/moderacion.routes").then((m) => m.MODERACION_ROUTES)
      },
      {
        path: "usuarios",
        title: `Usuarios · ${BRAND.nombre}`,
        canActivate: [permisoGuard("crear_usuario")],
        loadChildren: () => import("./features/usuarios/usuarios.routes").then((m) => m.USUARIOS_ROUTES)
      },
      {
        path: "ordenes",
        title: `Órdenes · ${BRAND.nombre}`,
        canActivate: [permisoGuard("ver_todas_ordenes")],
        loadChildren: () => import("./features/ordenes/ordenes.routes").then((m) => m.ORDENES_ROUTES)
      },
      {
        path: "liquidaciones",
        title: `Liquidaciones · ${BRAND.nombre}`,
        canActivate: [permisoGuard("liquidar_proveedor")],
        loadChildren: () => import("./features/liquidaciones/liquidaciones.routes").then((m) => m.LIQUIDACIONES_ROUTES)
      },
      {
        path: "reembolsos",
        title: `Reembolsos · ${BRAND.nombre}`,
        canActivate: [permisoGuard("emitir_reembolso")],
        loadChildren: () => import("./features/reembolsos/reembolsos.routes").then((m) => m.REEMBOLSOS_ROUTES)
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
