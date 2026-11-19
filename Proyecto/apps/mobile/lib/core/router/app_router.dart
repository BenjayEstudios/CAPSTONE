import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/alertas/presentation/alertas_page.dart';
import '../../features/auth/presentation/cuenta_page.dart';
import '../../features/calificaciones/presentation/calificaciones_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/sesion_controller.dart';
import '../../features/auth/presentation/splash_page.dart';
import '../../features/carro/presentation/carro_page.dart';
import '../../features/carro/presentation/widgets/icono_carro.dart';
import '../../features/catalogo/domain/catalogo_repository.dart';
import '../../features/catalogo/presentation/inicio_comprador_page.dart';
import '../../features/catalogo/presentation/listado_page.dart';
import '../../features/catalogo/presentation/producto_page.dart';
import '../../features/checkout/presentation/checkout_page.dart';
import '../../features/checkout/presentation/pasarela_simulada_page.dart';
import '../../features/checkout/presentation/resultado_pago_page.dart';
import '../../features/conexion/presentation/conexion_page.dart';
import '../../features/estadisticas/presentation/resumen_proveedor_page.dart';
import '../../features/ordenes/domain/orden.dart';
import '../../features/ordenes/presentation/cliente/mis_pedidos_page.dart';
import '../../features/ordenes/presentation/cliente/pedido_page.dart';
import '../../features/ordenes/presentation/proveedor/orden_proveedor_page.dart';
import '../../features/ordenes/presentation/proveedor/ordenes_vigentes_page.dart';
import 'perfil_shell.dart';
import 'redireccion.dart';
import 'rutas.dart';

// Rutas de la app. El router se reevalúa cada vez que cambia la sesión
// (login, logout, token expirado) y redirigir() decide a dónde ir.
final appRouterProvider = Provider<GoRouter>((ref) {
  final refrescar = ValueNotifier<int>(0);
  ref.listen(sesionProvider, (_, __) => refrescar.value++);

  final router = GoRouter(
    initialLocation: Rutas.splash,
    refreshListenable: refrescar,
    redirect: (context, state) => redirigir(ref.read(sesionProvider), state.uri.path),
    routes: [
      GoRoute(path: Rutas.splash, builder: (context, state) => const SplashPage()),
      GoRoute(path: Rutas.login, builder: (context, state) => const LoginPage()),
      GoRoute(path: Rutas.conexion, builder: (context, state) => const ConexionPage()),
      // Fuera del shell: la pasarela ocupa toda la pantalla, como una externa.
      GoRoute(
        path: '/comprador/pasarela/:id',
        builder: (context, state) => PasarelaSimuladaPage(
          ordenId: int.parse(state.pathParameters['id']!),
          medio: MedioPago.desdeCodigo(state.uri.queryParameters['medio']) ?? MedioPago.tarjeta,
        ),
      ),
      _shellComprador,
      _shellProveedor,
    ],
  );

  ref.onDispose(() {
    router.dispose();
    refrescar.dispose();
  });
  return router;
});

final _shellComprador = StatefulShellRoute.indexedStack(
  builder: (context, state, shell) => PerfilShell(
    shell: shell,
    destinos: const [
      NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Inicio'),
      NavigationDestination(icon: IconoCarro(), selectedIcon: IconoCarro(seleccionado: true), label: 'Carro'),
      NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Pedidos'),
      NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Cuenta'),
    ],
  ),
  branches: [
    StatefulShellBranch(routes: [
      // Catálogo y ficha cuelgan del inicio: la barra inferior sigue visible
      // y Atrás vuelve por el mismo camino.
      GoRoute(
        path: Rutas.comprador,
        builder: (context, state) => const InicioCompradorPage(),
        routes: [
          GoRoute(
            path: 'catalogo',
            builder: (context, state) {
              final q = state.uri.queryParameters;
              return ListadoPage(
                categoriaId: int.tryParse(q['categoriaId'] ?? ''),
                texto: q['q'],
                enfocarBusqueda: q['buscar'] == '1',
              );
            },
          ),
          GoRoute(
            path: 'producto/:id',
            builder: (context, state) => ProductoPage(
              productoId: int.parse(state.pathParameters['id']!),
              origen: OrigenVista.values.asNameMap()[state.uri.queryParameters['origen']] ?? OrigenVista.directo,
            ),
          ),
        ],
      ),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(
        path: Rutas.compradorCarro,
        builder: (context, state) => const CarroPage(),
        routes: [
          GoRoute(
            path: 'checkout',
            builder: (context, state) => const CheckoutPage(),
          ),
        ],
      ),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(
        path: Rutas.compradorPedidos,
        builder: (context, state) => const MisPedidosPage(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) => PedidoPage(ordenId: int.parse(state.pathParameters['id']!)),
          ),
          GoRoute(
            path: ':id/pago',
            builder: (context, state) => ResultadoPagoPage(
              ordenId: int.parse(state.pathParameters['id']!),
              error: state.uri.queryParameters['error'],
            ),
          ),
        ],
      ),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.compradorCuenta, builder: (context, state) => const CuentaPage()),
    ]),
  ],
);

final _shellProveedor = StatefulShellRoute.indexedStack(
  builder: (context, state, shell) => PerfilShell(
    shell: shell,
    destinos: const [
      NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'Resumen'),
      NavigationDestination(
          icon: Icon(Icons.local_shipping_outlined), selectedIcon: Icon(Icons.local_shipping), label: 'Órdenes'),
      // "Calificaciones" no cabe en una barra de 5 pestañas (se partía en dos líneas).
      NavigationDestination(icon: Icon(Icons.star_outline), selectedIcon: Icon(Icons.star), label: 'Reseñas'),
      NavigationDestination(icon: IconoAlertas(), selectedIcon: IconoAlertas(seleccionado: true), label: 'Alertas'),
      NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Cuenta'),
    ],
  ),
  branches: [
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.proveedor, builder: (context, state) => const ResumenProveedorPage()),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(
        path: Rutas.proveedorOrdenes,
        builder: (context, state) => const OrdenesVigentesPage(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) => OrdenProveedorPage(ordenId: int.parse(state.pathParameters['id']!)),
          ),
        ],
      ),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.proveedorCalificaciones, builder: (context, state) => const CalificacionesPage()),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.proveedorAlertas, builder: (context, state) => const AlertasPage()),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.proveedorCuenta, builder: (context, state) => const CuentaPage()),
    ]),
  ],
);
