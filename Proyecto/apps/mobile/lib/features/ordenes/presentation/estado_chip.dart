import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/orden.dart';

// Etiqueta de color para el estado de una orden o de un envío.
class EstadoChip extends StatelessWidget {
  const EstadoChip({super.key, required this.texto, required this.color});

  factory EstadoChip.orden(EstadoOrden e) => EstadoChip(texto: e.etiqueta, color: colorOrden(e));
  factory EstadoChip.envio(EstadoEnvio e) => EstadoChip(texto: e.etiqueta, color: colorEnvio(e));

  final String texto;
  final Color color;

  static Color colorOrden(EstadoOrden e) => switch (e) {
        EstadoOrden.pendientePago => const Color(0xFFB98E00),
        EstadoOrden.pagada || EstadoOrden.enPreparacion => AppColors.acento,
        EstadoOrden.despachada => AppColors.magenta,
        EstadoOrden.entregada => AppColors.verde,
        EstadoOrden.reembolsada => AppColors.textoSuave,
      };

  static Color colorEnvio(EstadoEnvio e) => switch (e) {
        EstadoEnvio.porDespachar => const Color(0xFFB98E00),
        EstadoEnvio.enPreparacion => AppColors.acento,
        EstadoEnvio.despachado || EstadoEnvio.listoRetiro => AppColors.magenta,
        EstadoEnvio.entregado => AppColors.verde,
        EstadoEnvio.cancelado => AppColors.textoSuave,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(texto, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}
