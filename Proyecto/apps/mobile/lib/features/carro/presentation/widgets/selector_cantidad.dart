import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

// "– 24 +" con límites: mínimo de compra y stock disponible.
class SelectorCantidad extends StatelessWidget {
  const SelectorCantidad({
    super.key,
    required this.cantidad,
    required this.minima,
    this.maxima,
    required this.onCambiar,
    this.habilitado = true,
  });

  final int cantidad;
  final int minima;
  final int? maxima;
  final ValueChanged<int> onCambiar;
  final bool habilitado;

  @override
  Widget build(BuildContext context) {
    final puedeBajar = habilitado && cantidad > minima;
    // Si ya supera el máximo (stock que bajó), solo se puede reducir.
    final puedeSubir = habilitado && (maxima == null || cantidad < maxima!);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.divisor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Quitar uno',
            icon: const Icon(Icons.remove_rounded, size: 18),
            onPressed: puedeBajar ? () => onCambiar(cantidad - 1) : null,
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 28),
            child: Text('$cantidad', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Agregar uno',
            icon: const Icon(Icons.add_rounded, size: 18),
            onPressed: puedeSubir ? () => onCambiar(cantidad + 1) : null,
          ),
        ],
      ),
    );
  }
}
