import { Routes } from "@angular/router";
import { invitadoGuard, sesionGuard } from "./core/auth/guards";
import { DatosPendiente } from "./features/pendiente/pendiente.component";

const pendiente = (datos: DatosPendiente) => ({
  loadComponent: () => import("./features/pendiente/pendiente.component").then((m) => m.PendienteComponent),
  data: datos
});

// Rutas del ecommerce. Regla de KAN-97: todo lo del catalogo se navega sin
// cuenta; lo que compra o muestra datos propios (checkout, pedidos) lleva
// sesionGuard.
export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    ...pendiente({ titulo: "Compara a tus distribuidores antes de comprar", ticket: "KAN-89", texto: "Aquí va el inicio con el buscador, las categorías y la mayor diferencia de precio del día." })
  },
  {
    path: "catalogo",
    ...pendiente({ titulo: "Catálogo", ticket: "KAN-90", texto: "Aquí va el catálogo por categoría con filtros. Se puede ver sin cuenta." })
  },
  {
    path: "checkout",
    canActivate: [sesionGuard],
    ...pendiente({ titulo: "Checkout", ticket: "KAN-95", texto: "Aquí va el pago único del carro multiproveedor. Esta pantalla exige sesión." })
  },
  {
    path: "ingresar",
    canActivate: [invitadoGuard],
    loadComponent: () => import("./features/cuenta/ingresar.component").then((m) => m.IngresarComponent),
    title: "Ingresar · Cotizapp"
  },
  {
    path: "registro",
    canActivate: [invitadoGuard],
    loadComponent: () => import("./features/cuenta/registro.component").then((m) => m.RegistroComponent),
    title: "Crear cuenta · Cotizapp"
  },
  {
    path: "recuperar-clave",
    loadComponent: () => import("./features/cuenta/recuperar-clave.component").then((m) => m.RecuperarClaveComponent),
    title: "Recuperar contraseña · Cotizapp"
  },
  {
    path: "restablecer-clave",
    loadComponent: () => import("./features/cuenta/restablecer-clave.component").then((m) => m.RestablecerClaveComponent),
    title: "Nueva contraseña · Cotizapp"
  },
  {
    // Verifica que el frontend conecta con el backend (antes era la portada).
    path: "estado",
    loadComponent: () => import("./features/status/status.component").then((m) => m.StatusComponent)
  },
  { path: "**", redirectTo: "" }
];
