import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/format/formatos.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../../core/widgets/graficos.dart';
import '../domain/estadisticas.dart';
import 'estadisticas_providers.dart';
import 'resumen_proveedor_page.dart';

final _mesLargo = DateFormat('MMMM', 'es_CL');
final _diaMes = DateFormat("d 'de' MMMM", 'es_CL');
final _diaCorto = DateFormat('d MMM', 'es_CL');

String _capitalizar(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

// Ventas del distribuidor (KAN-133): KPIs del mes vs. el anterior, venta
// semanal de 12 semanas y productos más vendidos.
class VentasView extends ConsumerStatefulWidget {
  const VentasView({super.key});

  @override
  ConsumerState<VentasView> createState() => _VentasViewState();
}

class _VentasViewState extends ConsumerState<VentasView> {
  late DateTime _mes = _inicioMes(ref.read(ahoraProvider)());
  bool _tabla = false;

  static DateTime _inicioMes(DateTime d) => DateTime(d.year, d.month);

  @override
  Widget build(BuildContext context) {
    final hoy = ref.watch(ahoraProvider)();
    final meses = [for (var i = 0; i < 3; i++) DateTime(hoy.year, hoy.month - i)];
    final comparacion = ref.watch(comparacionMensualProvider(_mes));
    final semanal = ref.watch(ventas12SemanasProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final m in meses)
              ChoiceChip(
                label: Text(_capitalizar(_mesLargo.format(m))),
                selected: m == _mes,
                onSelected: (_) => setState(() => _mes = m),
              ),
          ],
        ),
        const SizedBox(height: 12),
        AsyncValueView(
          value: comparacion,
          onReintentar: () => ref.invalidate(comparacionMensualProvider(_mes)),
          data: (c) => _Kpis(comparacion: c, enCurso: c.corte.month == hoy.month && c.corte.year == hoy.year),
        ),
        const SizedBox(height: 12),
        AsyncValueView(
          value: semanal,
          onReintentar: () => ref.invalidate(ventas12SemanasProvider),
          data: (r) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TituloSeccion(
                        titulo: 'Venta semanal',
                        subtitulo: 'Últimas 12 semanas · toca una barra para ver el detalle',
                        accion: TextButton(
                          onPressed: () => setState(() => _tabla = !_tabla),
                          child: Text(_tabla ? 'Ver gráfico' : 'Ver tabla'),
                        ),
                      ),
                      if (_tabla) _TablaSemanas(semanas: r.semanas) else _GraficoSemanas(semanas: r.semanas),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const TituloSeccion(titulo: 'Tus productos más vendidos', subtitulo: 'Últimas 12 semanas'),
                      if (r.productos.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Text('Sin ventas en este período.', style: TextStyle(color: AppColors.textoSuave)),
                        )
                      else
                        BarrasHorizontales(filas: [
                          for (final p in r.productos.take(5))
                            (
                              etiqueta: p.nombre,
                              valor: p.ventas,
                              texto: formatearClp(p.ventas),
                              nota: p.unidades == 1 ? '1 unidad' : '${p.unidades} unidades',
                            ),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Kpis extends StatelessWidget {
  const _Kpis({required this.comparacion, required this.enCurso});

  final ComparacionMensual comparacion;
  final bool enCurso;

  @override
  Widget build(BuildContext context) {
    final a = comparacion.actual;
    final b = comparacion.anterior;
    final anterior = _mesLargo.format(DateTime(comparacion.mes.year, comparacion.mes.month - 1));
    final contra = 'vs $anterior';
    double? v(num x, num? y) => ComparacionMensual.variacion(x, y);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          enCurso
              ? 'Cifras al ${_diaMes.format(comparacion.corte)}, comparadas con el mismo tramo de $anterior.'
              : '${_capitalizar(_mesLargo.format(comparacion.mes))} completo, comparado con $anterior.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
        ),
        const SizedBox(height: 8),
        // Filas que crecen con su contenido (una grilla de alto fijo se
        // desborda en pantallas chicas o con letra grande).
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                  child: TarjetaKpi(
                      etiqueta: 'Ventas',
                      valor: formatearClp(a.ventas),
                      variacion: v(a.ventas, b.ventas),
                      contra: contra)),
              const SizedBox(width: 10),
              Expanded(
                  child: TarjetaKpi(
                      etiqueta: 'Recibes (neto)',
                      valor: formatearClp(a.neto),
                      variacion: v(a.neto, b.neto),
                      contra: contra)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                  child: TarjetaKpi(
                      etiqueta: 'Envíos', valor: '${a.envios}', variacion: v(a.envios, b.envios), contra: contra)),
              const SizedBox(width: 10),
              Expanded(
                  child: TarjetaKpi(
                etiqueta: 'Ticket promedio',
                valor: a.ticketPromedio == null ? '—' : formatearClp(a.ticketPromedio!),
                variacion: a.ticketPromedio == null ? null : v(a.ticketPromedio!, b.ticketPromedio),
                contra: contra,
              )),
            ],
          ),
        ),
      ],
    );
  }
}

class _GraficoSemanas extends StatelessWidget {
  const _GraficoSemanas({required this.semanas});

  final List<VentaSemanal> semanas;

  @override
  Widget build(BuildContext context) {
    return GraficoColumnas(
      puntos: [
        for (final s in semanas)
          (
            etiqueta: '${s.semana.day}/${s.semana.month}',
            valor: s.ventas,
            detalle: 'Semana del ${_diaCorto.format(s.semana)}: ${formatearClp(s.ventas)} · '
                '${s.envios == 1 ? '1 envío' : '${s.envios} envíos'}',
          ),
      ],
    );
  }
}

class _TablaSemanas extends StatelessWidget {
  const _TablaSemanas({required this.semanas});

  final List<VentaSemanal> semanas;

  @override
  Widget build(BuildContext context) {
    const encabezado = TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5);
    const numero = TextStyle(fontFeatures: [FontFeature.tabularFigures()]);
    return Table(
      columnWidths: const {0: FlexColumnWidth(1.2), 1: FlexColumnWidth(0.8), 2: FlexColumnWidth(1.3)},
      children: [
        const TableRow(children: [
          Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Text('Semana del', style: encabezado)),
          Text('Envíos', style: encabezado, textAlign: TextAlign.right),
          Text('Ventas', style: encabezado, textAlign: TextAlign.right),
        ]),
        for (final s in semanas.reversed)
          TableRow(children: [
            Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(_diaCorto.format(s.semana))),
            Text('${s.envios}', style: numero, textAlign: TextAlign.right),
            Text(formatearClp(s.ventas), style: numero, textAlign: TextAlign.right),
          ]),
      ],
    );
  }
}
