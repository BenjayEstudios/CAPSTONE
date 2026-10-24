import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../auth/presentation/saludo.dart';
import '../domain/categoria.dart';
import 'catalogo_providers.dart';
import 'widgets/producto_card.dart';
import 'widgets/visual_categoria.dart';

// Inicio del comprador (KAN-127): saludo, buscador, categorías y los
// productos donde más se ahorra eligiendo bien el proveedor.
class InicioCompradorPage extends ConsumerWidget {
  const InicioCompradorPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final categorias = ref.watch(categoriasProvider);
    final destacados = ref.watch(destacadosProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Inicio')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriasProvider);
          ref.invalidate(destacadosProvider);
          await ref.read(destacadosProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const Saludo(),
            const SizedBox(height: 16),
            _BuscadorFalso(onTap: () => context.push(Rutas.catalogo(buscar: true))),
            const SizedBox(height: 24),
            _Titulo(
              texto: 'Categorías',
              accion: 'Ver todo',
              onAccion: () => context.push(Rutas.catalogo()),
            ),
            const SizedBox(height: 12),
            categorias.when(
              loading: () => const SizedBox(height: 96, child: CargandoView()),
              error: (e, _) => ErrorView(error: e, onReintentar: () => ref.invalidate(categoriasProvider)),
              data: (lista) => _GrillaCategorias(categorias: lista.raices),
            ),
            const SizedBox(height: 24),
            const _Titulo(texto: 'Mayor diferencia de precio hoy'),
            const SizedBox(height: 4),
            Text(
              'Mismo producto, distinto proveedor: aquí es donde más se nota.',
              style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
            ),
            const SizedBox(height: 12),
            destacados.when(
              loading: () => const SizedBox(height: 160, child: CargandoView()),
              error: (e, _) => ErrorView(error: e, onReintentar: () => ref.invalidate(destacadosProvider)),
              data: (productos) => Column(
                children: [
                  for (final p in productos) ...[
                    ProductoCard(
                      producto: p,
                      onTap: () => context.push(Rutas.producto(p.id, origen: 'catalogo')),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => context.push(Rutas.catalogo()),
              icon: const Icon(Icons.grid_view_rounded),
              label: const Text('Ver catálogo completo'),
            ),
          ],
        ),
      ),
    );
  }
}

// Parece un campo de texto, pero abre el listado con el teclado listo: la
// búsqueda real vive en una sola pantalla.
class _BuscadorFalso extends StatelessWidget {
  const _BuscadorFalso({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Buscar productos',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: onTap,
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: AppColors.divisor),
            ),
            child: const Row(
              children: [
                Icon(Icons.search_rounded, color: AppColors.textoSuave),
                SizedBox(width: 12),
                Expanded(
                  child: Text('Busca aceite, harina, queso…', style: TextStyle(color: AppColors.textoSuave)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo({required this.texto, this.accion, this.onAccion});

  final String texto;
  final String? accion;
  final VoidCallback? onAccion;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(texto, style: Theme.of(context).textTheme.titleMedium)),
        if (accion != null) TextButton(onPressed: onAccion, child: Text(accion!)),
      ],
    );
  }
}

class _GrillaCategorias extends StatelessWidget {
  const _GrillaCategorias({required this.categorias});

  final List<Categoria> categorias;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // 4 por fila en un teléfono normal; 3 si la pantalla es angosta.
        final porFila = constraints.maxWidth < 340 ? 3 : 4;
        final ancho = (constraints.maxWidth - (porFila - 1) * 10) / porFila;
        return Wrap(
          spacing: 10,
          runSpacing: 12,
          children: [
            for (final c in categorias)
              SizedBox(
                width: ancho,
                child: _TarjetaCategoria(categoria: c),
              ),
          ],
        );
      },
    );
  }
}

class _TarjetaCategoria extends StatelessWidget {
  const _TarjetaCategoria({required this.categoria});

  final Categoria categoria;

  @override
  Widget build(BuildContext context) {
    final visual = visualCategoria(categoria.id);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push(Rutas.catalogo(categoriaId: categoria.id)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: visual.color.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(visual.icono, color: visual.color, size: 28),
            ),
            const SizedBox(height: 6),
            Text(
              categoria.nombre,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.2),
            ),
          ],
        ),
      ),
    );
  }
}
