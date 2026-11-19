import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/orden.dart';
import '../ordenes_providers.dart';

// Calificar al proveedor de un envío entregado (KAN-132). Devuelve true si
// se guardó.
Future<bool?> mostrarCalificar(BuildContext context, {required int ordenId, required EnvioOrden envio}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => _CalificarSheet(ordenId: ordenId, envio: envio),
  );
}

class _CalificarSheet extends ConsumerStatefulWidget {
  const _CalificarSheet({required this.ordenId, required this.envio});

  final int ordenId;
  final EnvioOrden envio;

  @override
  ConsumerState<_CalificarSheet> createState() => _CalificarSheetState();
}

class _CalificarSheetState extends ConsumerState<_CalificarSheet> {
  int _puntaje = 0;
  final _comentario = TextEditingController();
  bool _enviando = false;
  String? _error;

  static const _textos = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

  @override
  void dispose() {
    _comentario.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref
          .read(ordenesRepositoryProvider)
          .calificarEnvio(widget.envio.id, puntaje: _puntaje, comentario: _comentario.text);
      ref
        ..invalidate(ordenProvider(widget.ordenId))
        ..invalidate(ordenesProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on Failure catch (f) {
      setState(() {
        _enviando = false;
        _error = switch (f.code) {
          'YA_CALIFICADO' => 'Este envío ya fue calificado.',
          'ENVIO_NO_CALIFICABLE' => 'Solo se puede calificar un envío entregado.',
          _ => f.message,
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('¿Cómo te fue con ${widget.envio.proveedorNombre}?', style: textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('Tu calificación la ven otros compradores al comparar proveedores.',
              style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  iconSize: 40,
                  tooltip: '$i estrella${i == 1 ? '' : 's'}',
                  onPressed: _enviando ? null : () => setState(() => _puntaje = i),
                  icon:
                      Icon(i <= _puntaje ? Icons.star_rounded : Icons.star_outline_rounded, color: AppColors.amarillo),
                ),
            ],
          ),
          Text(_textos[_puntaje], textAlign: TextAlign.center, style: textTheme.titleSmall),
          const SizedBox(height: 12),
          TextField(
            controller: _comentario,
            maxLength: 500,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Comentario (opcional)'),
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.magenta)),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _puntaje == 0 || _enviando ? null : _enviar,
            child: _enviando
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Enviar calificación'),
          ),
        ],
      ),
    );
  }
}
