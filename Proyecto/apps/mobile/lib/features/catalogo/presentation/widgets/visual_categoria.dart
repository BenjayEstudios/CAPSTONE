import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

// Ícono y color de cada categoría raíz del seed. Mientras los productos no
// tengan imágenes (producto.imagenes es NULL, KAN-157) se usan para las
// tarjetas y la ficha.
typedef VisualCategoria = ({IconData icono, Color color});

VisualCategoria visualCategoria(int? raizId) => switch (raizId) {
      1 => (icono: Icons.rice_bowl_rounded, color: const Color(0xFFB0752F)),
      2 => (icono: Icons.egg_rounded, color: const Color(0xFFC99A00)),
      3 => (icono: Icons.kebab_dining_rounded, color: const Color(0xFFE8613C)),
      4 => (icono: Icons.eco_rounded, color: AppColors.verde),
      5 => (icono: Icons.local_drink_rounded, color: AppColors.acento),
      6 => (icono: Icons.bakery_dining_rounded, color: const Color(0xFF9C5B2E)),
      7 => (icono: Icons.cleaning_services_rounded, color: const Color(0xFF6B5BD6)),
      _ => (icono: Icons.shopping_basket_rounded, color: AppColors.magenta),
    };

// Imagen del producto, o el ícono de su categoría sobre un fondo suave.
class ImagenProducto extends StatelessWidget {
  const ImagenProducto({super.key, required this.raizId, this.imagenUrl, this.tamano = 72, this.radio = 14});

  final int? raizId;
  final String? imagenUrl;
  final double tamano;
  final double radio;

  @override
  Widget build(BuildContext context) {
    final visual = visualCategoria(raizId);
    final placeholder = Container(
      width: tamano,
      height: tamano,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radio),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [visual.color.withValues(alpha: 0.10), visual.color.withValues(alpha: 0.22)],
        ),
      ),
      child: Icon(visual.icono, color: visual.color, size: tamano * 0.46),
    );
    if (imagenUrl == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radio),
      child: Image.network(
        imagenUrl!,
        width: tamano,
        height: tamano,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => placeholder,
      ),
    );
  }
}
