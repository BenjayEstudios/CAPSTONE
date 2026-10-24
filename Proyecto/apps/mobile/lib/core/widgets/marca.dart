import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Piezas de marca dibujadas en código (sin assets): funcionan offline y se
// ven nítidas en cualquier densidad.

// Isotipo: cuadrado redondeado magenta con una "C" blanca que encierra una
// etiqueta de precio cian (comparar precios).
class LogoCotizapp extends StatelessWidget {
  const LogoCotizapp({super.key, this.tamano = 44});

  final double tamano;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(dimension: tamano, child: CustomPaint(painter: _LogoPainter()));
  }
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final rect = Offset.zero & size;
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(s * 0.28)),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF3D8B), AppColors.magenta],
        ).createShader(rect),
    );

    // "C" abierta hacia la derecha.
    final c = Rect.fromCircle(center: Offset(s * 0.48, s * 0.5), radius: s * 0.26);
    canvas.drawArc(
      c,
      math.pi * 0.25,
      math.pi * 1.5,
      false,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.11
        ..strokeCap = StrokeCap.round,
    );

    // Etiqueta de precio en la abertura de la C.
    canvas.drawCircle(Offset(s * 0.72, s * 0.5), s * 0.09, Paint()..color = const Color(0xFF3FD0F5));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// Isotipo + nombre. claro = texto blanco, para fondos oscuros.
class MarcaCotizapp extends StatelessWidget {
  const MarcaCotizapp({super.key, this.claro = true, this.tamano = 40});

  final bool claro;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoCotizapp(tamano: tamano),
        SizedBox(width: tamano * 0.3),
        Text(
          'Cotizapp',
          style: TextStyle(
            fontSize: tamano * 0.6,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            color: claro ? Colors.white : AppColors.texto,
          ),
        ),
      ],
    );
  }
}

// Ondas superpuestas en cian, magenta y rosa para el pie de las
// pantallas oscuras (login, splash).
class OndasDecorativas extends StatelessWidget {
  const OndasDecorativas({super.key, this.alto = 160});

  final double alto;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox(height: alto, width: double.infinity, child: CustomPaint(painter: _OndasPainter())),
    );
  }
}

class _OndasPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    void onda(Color color, double alturaRelativa, double fase, double amplitud) {
      final w = size.width;
      final h = size.height;
      final y0 = h * (1 - alturaRelativa);
      final path = Path()..moveTo(0, y0);
      for (var x = 0.0; x <= w; x += 4) {
        path.lineTo(x, y0 + math.sin((x / w) * 2 * math.pi + fase) * amplitud);
      }
      path
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close();
      canvas.drawPath(path, Paint()..color = color);
    }

    // Sin amarillo: semitransparente sobre magenta se ve café.
    onda(AppColors.acento.withValues(alpha: 0.35), 0.95, 0.6, 14);
    onda(AppColors.magenta.withValues(alpha: 0.55), 0.7, 2.2, 18);
    onda(const Color(0xFFFF3D8B).withValues(alpha: 0.35), 0.45, 4.0, 12);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
