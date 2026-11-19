import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Gráficos del panel del distribuidor, dibujados sin librerías. Siguen la
// guía de visualización del equipo: una serie por gráfico (sin leyenda, el
// título la nombra), marcas finas en el acento cian, ejes y grilla tenues,
// rótulos solo donde aportan (el máximo), texto siempre en colores de texto
// y el detalle de cada punto al tocarlo. Cada uno tiene su vista de tabla en
// la pantalla que lo usa.

const _grilla = Color(0x14201E1D);
const _ejeTexto = TextStyle(fontSize: 10.5, color: AppColors.textoSuave);

// Un punto de una serie: etiqueta del eje X, valor y texto del detalle.
typedef PuntoSerie = ({String etiqueta, num valor, String detalle});

// "12K", "1,2M": ticks compactos del eje Y.
String compacto(num v) {
  if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(v % 1000000 == 0 ? 0 : 1).replaceAll('.', ',')}M';
  if (v >= 1000) return '${(v / 1000).round()}K';
  return '${v.round()}';
}

// Escala "limpia" para el eje Y: 4 divisiones con pasos 1/2/2,5/5 × 10^n.
({double maximo, double paso}) _escala(num maxValor) {
  if (maxValor <= 0) return (maximo: 4, paso: 1);
  final bruto = maxValor / 4;
  final potencia = math.pow(10, (math.log(bruto) / math.ln10).floor()).toDouble();
  final paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).firstWhere((p) => p >= bruto);
  return (maximo: paso * 4, paso: paso);
}

// Columnas verticales (serie temporal corta, ej. venta semanal).
class GraficoColumnas extends StatefulWidget {
  const GraficoColumnas({super.key, required this.puntos, this.alto = 180, this.formatoValor = compacto});

  final List<PuntoSerie> puntos;
  final double alto;
  final String Function(num) formatoValor;

  @override
  State<GraficoColumnas> createState() => _GraficoColumnasState();
}

class _GraficoColumnasState extends State<GraficoColumnas> {
  int? _tocado;

  @override
  Widget build(BuildContext context) {
    final puntos = widget.puntos;
    if (puntos.isEmpty) return SizedBox(height: widget.alto);
    final escala = _escala(puntos.map((p) => p.valor).reduce(math.max));
    final iMax = puntos.indexWhere((p) => p.valor == puntos.map((p) => p.valor).reduce(math.max));
    final seleccionado = _tocado == null ? null : puntos[_tocado!];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 20,
          child: seleccionado == null
              ? null
              : Text(seleccionado.detalle, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
        ),
        SizedBox(
          height: widget.alto,
          child: LayoutBuilder(builder: (context, c) {
            const ejeY = 36.0;
            final ancho = c.maxWidth - ejeY;
            final banda = ancho / puntos.length;
            int? indice(Offset p) {
              final i = ((p.dx - ejeY) / banda).floor();
              return i >= 0 && i < puntos.length ? i : null;
            }

            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) => setState(() => _tocado = indice(d.localPosition)),
              onHorizontalDragUpdate: (d) => setState(() => _tocado = indice(d.localPosition) ?? _tocado),
              child: CustomPaint(
                size: Size(c.maxWidth, widget.alto),
                painter: _ColumnasPainter(
                  puntos: puntos,
                  escala: escala,
                  ejeY: ejeY,
                  tocado: _tocado,
                  iMax: iMax,
                  formato: widget.formatoValor,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _ColumnasPainter extends CustomPainter {
  _ColumnasPainter({
    required this.puntos,
    required this.escala,
    required this.ejeY,
    required this.tocado,
    required this.iMax,
    required this.formato,
  });

  final List<PuntoSerie> puntos;
  final ({double maximo, double paso}) escala;
  final double ejeY;
  final int? tocado;
  final int iMax;
  final String Function(num) formato;

  static const _abajo = 18.0; // espacio para las etiquetas del eje X
  static const _arriba = 14.0; // espacio para el rótulo del máximo

  @override
  void paint(Canvas canvas, Size size) {
    final alto = size.height - _abajo - _arriba;
    double y(num v) => _arriba + alto - (v / escala.maximo) * alto;

    // Grilla y ticks del eje Y.
    final grilla = Paint()
      ..color = _grilla
      ..strokeWidth = 1;
    for (var v = 0.0; v <= escala.maximo + 0.001; v += escala.paso) {
      canvas.drawLine(Offset(ejeY, y(v)), Offset(size.width, y(v)), grilla);
      _texto(canvas, formato(v), Offset(0, y(v) - 7), _ejeTexto, ancho: ejeY - 6, alinear: TextAlign.right);
    }

    final banda = (size.width - ejeY) / puntos.length;
    final grosor = math.min(24.0, banda - 2); // ancho máximo 24, 2px de aire entre columnas
    // Etiquetas del eje X: una de cada tantas para que no choquen.
    final cada = (puntos.length / 6).ceil();
    for (final (i, p) in puntos.indexed) {
      final x = ejeY + banda * i + (banda - grosor) / 2;
      if (p.valor > 0) {
        final rect = Rect.fromLTRB(x, y(p.valor), x + grosor, y(0));
        final pintura = Paint()
          ..color = tocado == null || tocado == i ? AppColors.acento : AppColors.acento.withValues(alpha: 0.35);
        canvas.drawRRect(
          RRect.fromRectAndCorners(rect, topLeft: const Radius.circular(4), topRight: const Radius.circular(4)),
          pintura,
        );
      }
      if (i % cada == 0 || i == puntos.length - 1) {
        _texto(canvas, p.etiqueta, Offset(ejeY + banda * i - 10, size.height - _abajo + 4), _ejeTexto,
            ancho: banda + 20, alinear: TextAlign.center);
      }
      // Solo el máximo lleva rótulo; el resto, al tocar.
      if (i == iMax && p.valor > 0 && tocado == null) {
        _texto(canvas, formato(p.valor), Offset(x - 20, y(p.valor) - 14),
            const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.texto),
            ancho: grosor + 40, alinear: TextAlign.center);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ColumnasPainter old) => old.puntos != puntos || old.tocado != tocado;
}

// Línea con relleno suave (serie diaria, ej. vistas por día).
class GraficoLinea extends StatefulWidget {
  const GraficoLinea({super.key, required this.puntos, this.alto = 150});

  final List<PuntoSerie> puntos;
  final double alto;

  @override
  State<GraficoLinea> createState() => _GraficoLineaState();
}

class _GraficoLineaState extends State<GraficoLinea> {
  int? _tocado;

  @override
  Widget build(BuildContext context) {
    final puntos = widget.puntos;
    if (puntos.length < 2) return SizedBox(height: widget.alto);
    final escala = _escala(puntos.map((p) => p.valor).reduce(math.max));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 20,
          child: _tocado == null
              ? null
              : Text(puntos[_tocado!].detalle, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
        ),
        SizedBox(
          height: widget.alto,
          child: LayoutBuilder(builder: (context, c) {
            const ejeY = 30.0;
            int indice(Offset p) =>
                (((p.dx - ejeY) / (c.maxWidth - ejeY)) * (puntos.length - 1)).round().clamp(0, puntos.length - 1);
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) => setState(() => _tocado = indice(d.localPosition)),
              onHorizontalDragUpdate: (d) => setState(() => _tocado = indice(d.localPosition)),
              child: CustomPaint(
                size: Size(c.maxWidth, widget.alto),
                painter: _LineaPainter(puntos: puntos, escala: escala, ejeY: ejeY, tocado: _tocado),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _LineaPainter extends CustomPainter {
  _LineaPainter({required this.puntos, required this.escala, required this.ejeY, required this.tocado});

  final List<PuntoSerie> puntos;
  final ({double maximo, double paso}) escala;
  final double ejeY;
  final int? tocado;

  static const _abajo = 18.0;

  @override
  void paint(Canvas canvas, Size size) {
    final alto = size.height - _abajo - 4;
    final ancho = size.width - ejeY;
    double y(num v) => 4 + alto - (v / escala.maximo) * alto;
    double x(int i) => ejeY + ancho * i / (puntos.length - 1);

    final grilla = Paint()
      ..color = _grilla
      ..strokeWidth = 1;
    for (var v = 0.0; v <= escala.maximo + 0.001; v += escala.paso * 2) {
      canvas.drawLine(Offset(ejeY, y(v)), Offset(size.width, y(v)), grilla);
      _texto(canvas, compacto(v), Offset(0, y(v) - 7), _ejeTexto, ancho: ejeY - 6, alinear: TextAlign.right);
    }

    final linea = Path()..moveTo(x(0), y(puntos.first.valor));
    for (var i = 1; i < puntos.length; i++) {
      linea.lineTo(x(i), y(puntos[i].valor));
    }
    final area = Path.from(linea)
      ..lineTo(x(puntos.length - 1), y(0))
      ..lineTo(x(0), y(0))
      ..close();
    canvas.drawPath(area, Paint()..color = AppColors.acento.withValues(alpha: 0.10));
    canvas.drawPath(
      linea,
      Paint()
        ..color = AppColors.acento
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );

    // Primera y última fecha en el eje X.
    _texto(canvas, puntos.first.etiqueta, Offset(ejeY, size.height - _abajo + 4), _ejeTexto, ancho: 80);
    _texto(canvas, puntos.last.etiqueta, Offset(size.width - 80, size.height - _abajo + 4), _ejeTexto,
        ancho: 80, alinear: TextAlign.right);

    if (tocado != null) {
      final px = x(tocado!);
      final py = y(puntos[tocado!].valor);
      canvas.drawLine(Offset(px, 4), Offset(px, y(0)), Paint()..color = const Color(0x33201E1D));
      canvas.drawCircle(Offset(px, py), 6, Paint()..color = Colors.white); // anillo del color de la superficie
      canvas.drawCircle(Offset(px, py), 4, Paint()..color = AppColors.acento);
    }
  }

  @override
  bool shouldRepaint(covariant _LineaPainter old) => old.puntos != puntos || old.tocado != tocado;
}

// Ranking horizontal: nombre, barra proporcional y valor a la derecha.
class BarrasHorizontales extends StatelessWidget {
  const BarrasHorizontales({super.key, required this.filas, this.maximo});

  final List<({String etiqueta, num valor, String texto, String? nota})> filas;
  // Para comparar contra un total en vez del mayor de la lista.
  final num? maximo;

  @override
  Widget build(BuildContext context) {
    if (filas.isEmpty) return const SizedBox.shrink();
    final tope = maximo ?? filas.map((f) => f.valor).reduce(math.max);
    return Column(
      children: [
        for (final f in filas)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(f.etiqueta, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    const SizedBox(width: 8),
                    Text(f.texto, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 4),
                LayoutBuilder(builder: (context, c) {
                  final w = tope <= 0 ? 0.0 : (f.valor / tope).clamp(0, 1) * c.maxWidth;
                  return Stack(
                    children: [
                      Container(
                        height: 8,
                        decoration: BoxDecoration(
                            color: AppColors.acento.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                      ),
                      Container(
                        width: w,
                        height: 8,
                        decoration: BoxDecoration(color: AppColors.acento, borderRadius: BorderRadius.circular(4)),
                      ),
                    ],
                  );
                }),
                if (f.nota != null) ...[
                  const SizedBox(height: 2),
                  Text(f.nota!, style: const TextStyle(fontSize: 11.5, color: AppColors.textoSuave)),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

// Tarjeta de KPI: etiqueta, valor y variación con flecha y signo (no solo
// color) contra un período nombrado.
class TarjetaKpi extends StatelessWidget {
  const TarjetaKpi({super.key, required this.etiqueta, required this.valor, this.variacion, this.contra});

  final String etiqueta;
  final String valor;
  // Fracción (0,12 = +12%). null = sin base para comparar.
  final double? variacion;
  final String? contra;

  @override
  Widget build(BuildContext context) {
    final v = variacion;
    final sube = v != null && v > 0;
    final color = v == null || v == 0 ? AppColors.textoSuave : (sube ? AppColors.verde : const Color(0xFFB3261E));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(etiqueta, style: const TextStyle(color: AppColors.textoSuave, fontSize: 12.5)),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(valor, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                if (v != null && v != 0)
                  Icon(sube ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded, size: 14, color: color),
                Flexible(
                  child: Text(
                    v == null
                        ? 'sin datos ${contra ?? ''}'.trim()
                        : '${v > 0 ? '+' : ''}${(v * 100).round()}% ${contra ?? ''}'.trim(),
                    style: TextStyle(fontSize: 11.5, color: color),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

void _texto(Canvas canvas, String texto, Offset en, TextStyle estilo,
    {required double ancho, TextAlign alinear = TextAlign.left}) {
  final tp = TextPainter(
    text: TextSpan(text: texto, style: estilo),
    textAlign: alinear,
    textDirection: TextDirection.ltr,
    maxLines: 1,
    ellipsis: '…',
  )..layout(minWidth: ancho, maxWidth: ancho);
  tp.paint(canvas, en);
}
