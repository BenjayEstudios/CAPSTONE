import { Routes } from "@angular/router";
import { invitadoGuard, sesionGuard } from "./core/auth/guards";

// Rutas del ecommerce. Regla de KAN-97: todo lo del catalogo se navega sin
// cuenta; lo que compra o muestra datos propios (checkout, pedidos) lleva
// sesionGuard.
export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./features/inicio/inicio.component").then((m) => m.InicioComponent),
    title: "Cotizapp · Compra a distribuidores comparando precios"
  },
  {
    path: "catalogo",
    loadComponent: () => import("./features/catalogo/catalogo.component").then((m) => m.CatalogoComponent),
    title: "Catálogo · Cotizapp"
  },
  {
    path: "buscar",
    loadComponent: () => import("./features/catalogo/busqueda.component").then((m) => m.BusquedaComponent),
    title: "Buscar · Cotizapp"
  },
  {
    path: "producto/:id",
    loadComponent: () => import("./features/producto/producto.component").then((m) => m.ProductoComponent),
    title: "Producto · Cotizapp"
  },
  {
    path: "carro",
    canActivate: [sesionGuard],
    loadComponent: () => import("./features/carro/carro.component").then((m) => m.CarroComponent),
    title: "Carro · Cotizapp"
  },
  {
    path: "checkout",
    pathMatch: "full",
    canActivate: [sesionGuard],
    loadComponent: () => import("./features/checkout/checkout.component").then((m) => m.CheckoutComponent),
    title: "Pago · Cotizapp"
  },
  {
    // Adonde vuelve el comprador desde Webpay (el backend redirige aqui).
    path: "checkout/resultado",
    canActivate: [sesionGuard],
    loadComponent: () => import("./features/checkout/resultado.component").then((m) => m.ResultadoPagoComponent),
    title: "Resultado del pago · Cotizapp"
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
