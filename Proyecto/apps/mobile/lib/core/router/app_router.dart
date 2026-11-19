import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/cuenta_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/saludo.dart';
import '../../features/auth/presentation/sesion_controller.dart';
import '../../features/auth/presentation/splash_page.dart';
import '../../features/catalogo/domain/catalogo_repository.dart';
import '../../features/catalogo/presentation/inicio_comprador_page.dart';
import '../../features/catalogo/presentation/listado_page.dart';
import '../../features/catalogo/presentation/producto_page.dart';
import '../../features/conexion/presentation/conexion_page.dart';
import '../widgets/pantalla_pendiente.dart';
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

GoRoute _pendiente(String path, String titulo, String ticket, String descripcion, IconData icono,
        {bool saludo = false}) =>
    GoRoute(
      path: path,
      builder: (context, state) => PantallaPendiente(
        titulo: titulo,
        ticket: ticket,
        descripcion: descripcion,
        icono: icono,
        encabezado: saludo ? const Saludo() : null,
      ),
    );

final _shellComprador = StatefulShellRoute.indexedStack(
  builder: (context, state, shell) => PerfilShell(
    shell: shell,
    destinos: const [
      NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Inicio'),
      NavigationDestination(
          icon: Icon(Icons.shopping_cart_outlined), selectedIcon: Icon(Icons.shopping_cart), label: 'Carro'),
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
      _pendiente(Rutas.compradorCarro, 'Tu carro', 'KAN-130', 'Carro multiproveedor', Icons.shopping_cart_rounded),
    ]),
    StatefulShellBranch(routes: [
      _pendiente(Rutas.compradorPedidos, 'Mis pedidos', 'KAN-132', 'Historial y estado de tus pedidos',
          Icons.receipt_long_rounded),
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
      NavigationDestination(
          icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Alertas'),
      NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Cuenta'),
    ],
  ),
  branches: [
    StatefulShellBranch(routes: [
      _pendiente(
          Rutas.proveedor, 'Resumen', 'KAN-133 / KAN-134', 'Ventas, visitas y conversión', Icons.insights_rounded,
          saludo: true),
    ]),
    StatefulShellBranch(routes: [
      _pendiente(Rutas.proveedorOrdenes, 'Órdenes vigentes', 'KAN-136', 'Órdenes por preparar y despachar',
          Icons.local_shipping_rounded),
    ]),
    StatefulShellBranch(routes: [
      _pendiente(
          Rutas.proveedorCalificaciones, 'Calificaciones', 'KAN-135', 'Reseñas de tus clientes', Icons.star_rounded),
    ]),
    StatefulShellBranch(routes: [
      _pendiente(Rutas.proveedorAlertas, 'Alertas', 'KAN-137', 'Lo que requiere tu atención',
          Icons.notifications_active_rounded),
    ]),
    StatefulShellBranch(routes: [
      GoRoute(path: Rutas.proveedorCuenta, builder: (context, state) => const CuentaPage()),
    ]),
  ],
);
