import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/categoria.dart';
import '../../domain/filtros_catalogo.dart';
import '../catalogo_providers.dart';

// Hoja con todos los filtros del listado (KAN-128). Devuelve los filtros
// nuevos al aplicar, o null si se cierra sin aplicar.
Future<FiltrosCatalogo?> mostrarFiltros(BuildContext context, FiltrosCatalogo actuales) {
  return showModalBottomSheet<FiltrosCatalogo>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (context) => _FiltrosSheet(iniciales: actuales),
  );
}

class _FiltrosSheet extends ConsumerStatefulWidget {
  const _FiltrosSheet({required this.iniciales});

  final FiltrosCatalogo iniciales;

  @override
  ConsumerState<_FiltrosSheet> createState() => _FiltrosSheetState();
}

class _FiltrosSheetState extends ConsumerState<_FiltrosSheet> {
  late FiltrosCatalogo _f = widget.iniciales;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final categorias = ref.watch(categoriasProvider).valueOrNull ?? const <Categoria>[];
    final raices = categorias.raices;
    // Si hay una subcategoría elegida, se marca su raíz y se ofrecen sus hermanas.
    final raizElegida = _f.categoriaId == null ? null : categorias.raizDe(_f.categoriaId!);
    final subcategorias = raizElegida == null ? const <Categoria>[] : categorias.hijasDe(raizElegida.id);

    // Los botones quedan fijos abajo; solo los filtros hacen scroll.
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Filtros', style: textTheme.titleLarge),
                  const SizedBox(height: 20),
                  Text('Categoría', style: textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Todas'),
                        selected: _f.categoriaId == null,
                        onSelected: (_) => setState(() => _f = _f.copyWith(categoriaId: () => null)),
                      ),
                      for (final c in raices)
                        ChoiceChip(
                          label: Text(c.nombre),
                          selected: raizElegida?.id == c.id,
                          onSelected: (_) => setState(() => _f = _f.copyWith(categoriaId: () => c.id)),
                        ),
                    ],
                  ),
                  if (subcategorias.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final c in subcategorias)
                          FilterChip(
                            label: Text(c.nombre),
                            selected: _f.categoriaId == c.id,
                            onSelected: (sel) =>
                                setState(() => _f = _f.copyWith(categoriaId: () => sel ? c.id : raizElegida!.id)),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 24),
                  Text('Plazo de entrega', style: textTheme.titleSmall),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<int?>(
                      segments: const [
                        ButtonSegment(value: null, label: Text('Cualquiera')),
                        ButtonSegment(value: 24, label: Text('24 h')),
                        ButtonSegment(value: 48, label: Text('48 h')),
                      ],
                      selected: {_f.plazoMaxHoras},
                      onSelectionChanged: (sel) => setState(() => _f = _f.copyWith(plazoMaxHoras: () => sel.first)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Caja chica'),
                    subtitle:
                        const Text('Solo ofertas de hasta ${FiltrosCatalogo.maxUnidadesCajaChica} unidades por caja'),
                    value: _f.cajaChica,
                    onChanged: (v) => setState(() => _f = _f.copyWith(cajaChica: v)),
                  ),
                  const SizedBox(height: 8),
                  Text('Ordenar por', style: textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final o in OrdenCatalogo.values)
                        ChoiceChip(
                          label: Text(o.etiqueta),
                          selected: _f.orden == o,
                          onSelected: (_) => setState(() => _f = _f.copyWith(orden: o)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _f = FiltrosCatalogo(texto: _f.texto)),
                  child: const Text('Limpiar'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(_f),
                  child: const Text('Aplicar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
