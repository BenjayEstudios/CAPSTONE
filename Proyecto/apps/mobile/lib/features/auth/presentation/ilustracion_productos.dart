import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

// Ilustración del login: una canasta al centro rodeada de rubros del
// catálogo, y dos etiquetas con precios de distintos proveedores para
// insinuar el comparador. Solo íconos de Material, sin assets.
class IlustracionProductos extends StatelessWidget {
  const IlustracionProductos({super.key, this.alto = 190});

  final double alto;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: alto,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = alto;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              // Halo detrás de la canasta.
              Positioned(
                left: w / 2 - h * 0.42,
                top: h * 0.08,
                child: Container(
                  width: h * 0.84,
                  height: h * 0.84,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [
                      AppColors.magenta.withValues(alpha: 0.35),
                      AppColors.magenta.withValues(alpha: 0),
                    ]),
                  ),
                ),
              ),
              Positioned(
                left: w / 2 - 44,
                top: h / 2 - 44,
                child: const _Burbuja(icono: Icons.shopping_basket_rounded, tamano: 88, color: AppColors.magenta),
              ),
              Positioned(
                  left: w * 0.08,
                  top: h * 0.12,
                  child: const _Burbuja(icono: Icons.eco_rounded, color: Color(0xFF2E9D5B))),
              Positioned(
                  left: w * 0.02,
                  top: h * 0.58,
                  child: const _Burbuja(icono: Icons.egg_rounded, color: AppColors.amarillo)),
              Positioned(
                  right: w * 0.08,
                  top: h * 0.08,
                  child: const _Burbuja(icono: Icons.local_drink_rounded, color: AppColors.acento)),
              Positioned(
                  right: w * 0.02,
                  top: h * 0.56,
                  child: const _Burbuja(icono: Icons.set_meal_rounded, color: Color(0xFFE8613C))),
              Positioned(
                  left: w * 0.24,
                  bottom: 0,
                  child: const _Burbuja(icono: Icons.bakery_dining_rounded, tamano: 40, color: Color(0xFFB0752F))),
              Positioned(left: w * 0.22, top: h * 0.02, child: const _Etiqueta(precio: r'$12.490', destacada: true)),
              Positioned(right: w * 0.2, bottom: h * 0.06, child: const _Etiqueta(precio: r'$12.890')),
            ],
          );
        },
      ),
    );
  }
}

class _Burbuja extends StatelessWidget {
  const _Burbuja({required this.icono, required this.color, this.tamano = 52});

  final IconData icono;
  final Color color;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: tamano,
      height: tamano,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Icon(icono, color: color, size: tamano * 0.52),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  const _Etiqueta({required this.precio, this.destacada = false});

  final String precio;
  final bool destacada;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: destacada ? AppColors.amarillo : AppColors.tintaClara,
        borderRadius: BorderRadius.circular(20),
        border: destacada ? null : Border.all(color: Colors.white24),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            destacada ? Icons.trending_down_rounded : Icons.sell_outlined,
            size: 14,
            color: destacada ? AppColors.texto : Colors.white70,
          ),
          const SizedBox(width: 4),
          Text(
            precio,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: destacada ? AppColors.texto : Colors.white70,
            ),
          ),
        ],
      ),
    );
  }
}
