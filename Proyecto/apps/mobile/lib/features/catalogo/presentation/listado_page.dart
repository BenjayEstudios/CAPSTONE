import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../domain/categoria.dart';
import '../domain/filtros_catalogo.dart';
import 'catalogo_providers.dart';
import 'widgets/filtros_sheet.dart';
import 'widgets/producto_card.dart';

// Listado del catálogo con búsqueda y filtros (KAN-127 búsqueda, KAN-128
// filtros). Los filtros viven en el estado de la pantalla; cada cambio
// genera un FiltrosCatalogo nuevo que es la clave de resultadosProvider.
class ListadoPage extends ConsumerStatefulWidget {
  const ListadoPage({super.key, this.categoriaId, this.texto, this.enfocarBusqueda = false});

  final int? categoriaId;
  final String? texto;
  final bool enfocarBusqueda;

  @override
  ConsumerState<ListadoPage> createState() => _ListadoPageState();
}

class _ListadoPageState extends ConsumerState<ListadoPage> {
  late FiltrosCatalogo _filtros;
  late final TextEditingController _busqueda;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _filtros = FiltrosCatalogo(categoriaId: widget.categoriaId, texto: widget.texto ?? '');
    _busqueda = TextEditingController(text: widget.texto ?? '');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _busqueda.dispose();
    super.dispose();
  }

  // Espera a que el usuario deje de escribir para no pedir una búsqueda por
  // cada letra.
  void _alEscribir(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _filtros = _filtros.copyWith(texto: texto));
    });
  }

  void _limpiarBusqueda() {
    _debounce?.cancel();
    _busqueda.clear();
    setState(() => _filtros = _filtros.copyWith(texto: ''));
  }

  Future<void> _abrirFiltros() async {
    final nuevos = await mostrarFiltros(context, _filtros);
    if (nuevos != null && mounted) setState(() => _filtros = nuevos);
  }

  void _limpiarFiltros() {
    setState(() => _filtros = FiltrosCatalogo(texto: _filtros.texto));
  }

  @override
  Widget build(BuildContext context) {
    final categorias = ref.watch(categoriasProvider).valueOrNull ?? const <Categoria>[];
    final categoria = _filtros.categoriaId == null ? null : categorias.porId(_filtros.categoriaId!);
    final resultados = ref.watch(resultadosProvider(_filtros));
    final porUnidad = ref.watch(verPrecioPorUnidadProvider);
    final origen = _filtros.texto.trim().isNotEmpty ? 'busqueda' : 'catalogo';

    return Scaffold(
      appBar: AppBar(title: Text(categoria?.nombre ?? 'Catálogo')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: _busqueda,
              autofocus: widget.enfocarBusqueda,
              textInputAction: TextInputAction.search,
              onChanged: _alEscribir,
              onSubmitted: (t) {
                _debounce?.cancel();
                setState(() => _filtros = _filtros.copyWith(texto: t));
              },
              decoration: InputDecoration(
                hintText: 'Busca aceite, harina, queso…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: ListenableBuilder(
                  listenable: _busqueda,
                  builder: (context, _) => _busqueda.text.isEmpty
                      ? const SizedBox.shrink()
                      : IconButton(
                          icon: const Icon(Icons.close_rounded),
                          tooltip: 'Borrar búsqueda',
                          onPressed: _limpiarBusqueda,
                        ),
                ),
                border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(28))),
                enabledBorder: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(28)),
                  borderSide: BorderSide(color: AppColors.divisor),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _BotonFiltros(activos: _filtros.activos, onPressed: _abrirFiltros),
                const SizedBox(width: 8),
                if (categoria != null) ...[
                  InputChip(
                    label: Text(categoria.nombre),
                    selected: true,
                    onDeleted: () => setState(() => _filtros = _filtros.copyWith(categoriaId: () => null)),
                    onPressed: _abrirFiltros,
                  ),
                  const SizedBox(width: 8),
                ],
                for (final horas in const [24, 48]) ...[
                  FilterChip(
                    label: Text('Entrega $horas h'),
                    selected: _filtros.plazoMaxHoras == horas,
                    onSelected: (sel) =>
                        setState(() => _filtros = _filtros.copyWith(plazoMaxHoras: () => sel ? horas : null)),
                  ),
                  const SizedBox(width: 8),
                ],
                FilterChip(
                  label: const Text('Caja chica'),
                  tooltip: 'Hasta ${FiltrosCatalogo.maxUnidadesCajaChica} unidades por caja',
                  selected: _filtros.cajaChica,
                  onSelected: (sel) => setState(() => _filtros = _filtros.copyWith(cajaChica: sel)),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    resultados.whenOrNull(
                          data: (p) => p.total == 1 ? '1 producto' : '${p.total} productos',
                        ) ??
                        ' ',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                  ),
                ),
                _MenuOrden(
                  orden: _filtros.orden,
                  onCambiar: (o) => setState(() => _filtros = _filtros.copyWith(orden: o)),
                ),
                IconButton(
                  isSelected: porUnidad,
                  tooltip: porUnidad ? 'Ver precio por formato' : 'Ver precio por kg / L',
                  icon: const Icon(Icons.scale_outlined),
                  selectedIcon: const Icon(Icons.scale_rounded, color: AppColors.magenta),
                  onPressed: () => ref.read(verPrecioPorUnidadProvider.notifier).state = !porUnidad,
                ),
              ],
            ),
          ),
          Expanded(
            child: resultados.when(
              loading: () => const CargandoView(),
              error: (e, _) => ErrorView(error: e, onReintentar: () => ref.invalidate(resultadosProvider(_filtros))),
              data: (pagina) => pagina.items.isEmpty
                  ? VacioView(
                      titulo: 'No encontramos productos',
                      mensaje: _filtros.texto.isNotEmpty
                          ? 'Prueba con otra palabra o quita algún filtro.'
                          : 'Prueba quitando algún filtro.',
                      accion: _filtros.activos > 0
                          ? OutlinedButton(onPressed: _limpiarFiltros, child: const Text('Limpiar filtros'))
                          : null,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: pagina.items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final p = pagina.items[i];
                        return ProductoCard(
                          producto: p,
                          onTap: () => context.push(Rutas.producto(p.id, origen: origen)),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BotonFiltros extends StatelessWidget {
  const _BotonFiltros({required this.activos, required this.onPressed});

  final int activos;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: const Icon(Icons.tune_rounded, size: 18),
      label: Text(activos == 0 ? 'Filtros' : 'Filtros ($activos)'),
      onPressed: onPressed,
    );
  }
}

class _MenuOrden extends StatelessWidget {
  const _MenuOrden({required this.orden, required this.onCambiar});

  final OrdenCatalogo orden;
  final ValueChanged<OrdenCatalogo> onCambiar;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<OrdenCatalogo>(
      tooltip: 'Ordenar',
      initialValue: orden,
      onSelected: onCambiar,
      itemBuilder: (context) => [
        for (final o in OrdenCatalogo.values) PopupMenuItem(value: o, child: Text(o.etiqueta)),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.sort_rounded, size: 18),
            const SizedBox(width: 4),
            Text(orden.etiqueta, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
