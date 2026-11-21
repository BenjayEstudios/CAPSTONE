import { Routes } from "@angular/router";
import { invitadoGuard, proveedorGuard, sesionGuard } from "./core/auth/guards";

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
    path: "pedidos",
    canActivate: [sesionGuard],
    loadComponent: () => import("./features/pedidos/pedidos.component").then((m) => m.PedidosComponent),
    title: "Mis pedidos · Cotizapp"
  },
  {
    path: "pedidos/:id",
    canActivate: [sesionGuard],
    loadComponent: () => import("./features/pedidos/pedido.component").then((m) => m.PedidoComponent),
    title: "Pedido · Cotizapp"
  },
  {
    // Panel del proveedor (KAN-101 en adelante): cada historia agrega su hija y su pestaña.
    path: "proveedor",
    canActivate: [proveedorGuard],
    loadComponent: () => import("./features/proveedor/panel-proveedor.component").then((m) => m.PanelProveedorComponent),
    children: [
      {
        path: "",
        pathMatch: "full",
        loadComponent: () => import("./features/proveedor/dashboard.component").then((m) => m.DashboardProveedorComponent),
        title: "Panel · Cotizapp para distribuidores"
      },
      {
        path: "productos",
        loadComponent: () => import("./features/proveedor/productos.component").then((m) => m.MisProductosComponent),
        title: "Mis productos · Cotizapp para distribuidores"
      },
      {
        path: "ventas",
        loadComponent: () => import("./features/proveedor/ventas.component").then((m) => m.VentasProveedorComponent),
        title: "Órdenes de venta · Cotizapp para distribuidores"
      },
      {
        path: "clientes",
        loadComponent: () => import("./features/proveedor/clientes.component").then((m) => m.ClientesProveedorComponent),
        title: "Tus clientes · Cotizapp para distribuidores"
      },
      {
        path: "demanda",
        loadComponent: () => import("./features/proveedor/demanda.component").then((m) => m.DemandaProveedorComponent),
        title: "Demanda y cobertura · Cotizapp para distribuidores"
      },
      {
        path: "perfil",
        loadComponent: () => import("./features/proveedor/perfil.component").then((m) => m.PerfilProveedorComponent),
        title: "Perfil de empresa · Cotizapp para distribuidores"
      },
      {
        path: "asignar",
        loadComponent: () => import("./features/proveedor/asignar.component").then((m) => m.AsignarProductoComponent),
        title: "Asignarme un producto · Cotizapp para distribuidores"
      }
    ]
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
    // Solicitud de alta de distribuidor (KAN-100). Publica: quien ya tiene sesion no la necesita.
    path: "vender",
    canActivate: [invitadoGuard],
    loadComponent: () => import("./features/cuenta/vender.component").then((m) => m.VenderComponent),
    title: "Vender en Cotizapp"
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
