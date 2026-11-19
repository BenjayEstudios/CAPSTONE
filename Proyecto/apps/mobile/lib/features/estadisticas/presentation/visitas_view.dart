import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../../core/widgets/graficos.dart';
import '../domain/estadisticas.dart';
import 'estadisticas_providers.dart';
import 'resumen_proveedor_page.dart';

final _diaCorto = DateFormat('d MMM', 'es_CL');
final _porcentaje = NumberFormat('0.#', 'es_CL');

String pct(double fraccion) => '${_porcentaje.format(fraccion * 100)}%';

// Visitas y conversión (KAN-134): cuántos clientes ven y clickean sus
// productos, por día, por producto y por comuna.
class VisitasView extends ConsumerStatefulWidget {
  const VisitasView({super.key});

  @override
  ConsumerState<VisitasView> createState() => _VisitasViewState();
}

class _VisitasViewState extends ConsumerState<VisitasView> {
  int _dias = 30;

  @override
  Widget build(BuildContext context) {
    final visitas = ref.watch(visitasProvider(_dias));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final d in const [30, 90])
              ChoiceChip(
                label: Text('Últimos $d días'),
                selected: _dias == d,
                onSelected: (_) => setState(() => _dias = d),
              ),
          ],
        ),
        const SizedBox(height: 12),
        AsyncValueView(
          value: visitas,
          onReintentar: () => ref.invalidate(visitasProvider(_dias)),
          data: (v) => _Contenido(visitas: v),
        ),
      ],
    );
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({required this.visitas});

  final Visitas visitas;

  @override
  Widget build(BuildContext context) {
    final v = visitas;
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: _Cifra(etiqueta: 'Vistas', valor: '${v.vistas}')),
            const SizedBox(width: 8),
            Expanded(child: _Cifra(etiqueta: 'Clicks', valor: '${v.clicks}')),
            const SizedBox(width: 8),
            Expanded(child: _Cifra(etiqueta: 'Conversión', valor: pct(v.conversion))),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Vista = alguien abrió la ficha de un producto que vendes. Click = agregó tu oferta al carro.',
          style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const TituloSeccion(titulo: 'Vistas por día', subtitulo: 'Arrastra sobre el gráfico para ver cada día'),
                GraficoLinea(puntos: [
                  for (final d in v.porDia)
                    (
                      etiqueta: _diaCorto.format(d.fecha),
                      valor: d.vistas,
                      detalle: '${_diaCorto.format(d.fecha)}: ${d.vistas} vistas · ${d.clicks} clicks',
                    ),
                ]),
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
                const TituloSeccion(titulo: 'Más vistos y más clickeados'),
                if (v.porProducto.isEmpty)
                  const Text('Sin visitas en este período.', style: TextStyle(color: AppColors.textoSuave))
                else
                  BarrasHorizontales(filas: [
                    for (final p in v.porProducto)
                      (
                        etiqueta: p.producto,
                        valor: p.vistas,
                        texto: '${p.vistas} vistas',
                        nota: '${p.clicks} clicks · ${pct(p.conversion)} de conversión',
                      ),
                  ]),
              ],
            ),
          ),
        ),
        if (v.porComuna != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const TituloSeccion(
                    titulo: 'Clientes potenciales por ubicación',
                    subtitulo: 'Desde dónde miran tus productos',
                  ),
                  if (v.porComuna!.isEmpty)
                    const Text('Sin datos de ubicación en este período.', style: TextStyle(color: AppColors.textoSuave))
                  else
                    BarrasHorizontales(filas: [
                      for (final c in v.porComuna!.take(8))
                        (
                          etiqueta: c.comuna,
                          valor: c.vistas,
                          texto: '${c.vistas} vistas',
                          nota: c.cubre ? 'Despachas ahí' : 'Fuera de tu cobertura: no les puedes despachar',
                        ),
                    ]),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Cifra extends StatelessWidget {
  const _Cifra({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        child: Column(
          children: [
            Text(etiqueta, style: const TextStyle(color: AppColors.textoSuave, fontSize: 12.5)),
            const SizedBox(height: 4),
            FittedBox(child: Text(valor, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700))),
          ],
        ),
      ),
    );
  }
}
