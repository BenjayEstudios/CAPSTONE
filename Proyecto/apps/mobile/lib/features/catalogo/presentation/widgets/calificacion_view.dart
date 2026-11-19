import 'package:flutter/material.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/producto.dart';

// "★ 4,7 (6)" o "Sin calificaciones".
class CalificacionView extends StatelessWidget {
  const CalificacionView({super.key, required this.calificacion});

  final ResumenCalificacion calificacion;

  @override
  Widget build(BuildContext context) {
    final estilo = Theme.of(context).textTheme.bodySmall;
    final promedio = calificacion.promedio;
    if (promedio == null) {
      return Text('Sin calificaciones', style: estilo?.copyWith(color: AppColors.textoSuave));
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 16, color: AppColors.amarillo),
        const SizedBox(width: 2),
        Text(formatearPromedio(promedio), style: estilo?.copyWith(fontWeight: FontWeight.w700)),
        Text(' (${calificacion.cantidad})', style: estilo?.copyWith(color: AppColors.textoSuave)),
      ],
    );
  }
}
