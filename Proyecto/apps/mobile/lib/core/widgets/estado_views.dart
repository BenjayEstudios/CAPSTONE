import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../error/failure.dart';

// Vistas de carga / error / vacío comunes a todas las pantallas, para que
// cada feature no reinvente su spinner.

class CargandoView extends StatelessWidget {
  const CargandoView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onReintentar});

  final Object error;
  final VoidCallback? onReintentar;

  @override
  Widget build(BuildContext context) {
    final mensaje = error is Failure ? (error as Failure).message : 'Ocurrió un error inesperado.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(mensaje, textAlign: TextAlign.center),
            if (onReintentar != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onReintentar, child: const Text('Reintentar')),
            ],
          ],
        ),
      ),
    );
  }
}

class VacioView extends StatelessWidget {
  const VacioView({super.key, required this.titulo, this.mensaje, this.accion});

  final String titulo;
  final String? mensaje;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(titulo, style: textTheme.titleMedium, textAlign: TextAlign.center),
            if (mensaje != null) ...[
              const SizedBox(height: 8),
              Text(mensaje!, style: textTheme.bodyMedium, textAlign: TextAlign.center),
            ],
            if (accion != null) ...[const SizedBox(height: 16), accion!],
          ],
        ),
      ),
    );
  }
}

// Atajo para el patrón "loading / error con reintento / data" de un
// AsyncValue de Riverpod.
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({super.key, required this.value, required this.data, this.onReintentar});

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onReintentar;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: data,
      loading: () => const CargandoView(),
      error: (error, _) => ErrorView(error: error, onReintentar: onReintentar),
    );
  }
}
