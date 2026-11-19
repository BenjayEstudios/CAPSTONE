import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Scaffold con la barra de navegación inferior de cada perfil. Cada pestaña
// es una rama de StatefulShellRoute y conserva su propio stack.
class PerfilShell extends StatelessWidget {
  const PerfilShell({super.key, required this.shell, required this.destinos});

  final StatefulNavigationShell shell;
  final List<NavigationDestination> destinos;

  @override
  Widget build(BuildContext context) {
    // Atrás de Android desde otra pestaña vuelve a la primera en vez de
    // cerrar la app; solo desde la primera sale.
    return PopScope(
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          destinations: destinos,
          // Tocar la pestaña activa vuelve a su raíz.
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        ),
      ),
    );
  }
}
