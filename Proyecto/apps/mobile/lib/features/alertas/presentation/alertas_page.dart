import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/format/formatos.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../domain/alertas.dart';
import 'alertas_providers.dart';

final _diaSemana = DateFormat("EEEE d 'de' MMMM", 'es_CL');

// Pestaña Alertas del distribuidor (KAN-137): lo que requiere atención y lo
// que tiene por cobrar.
class AlertasPage extends ConsumerWidget {
  const AlertasPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(alertasProveedorProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas')),
      body: AsyncValueView(
        value: datos,
        onReintentar: () => ref.invalidate(alertasProveedorProvider),
        data: (a) {
          final alertas = alertasDe(a);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(alertasProveedorProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                _PorCobrar(porCobrar: a.porCobrar),
                const SizedBox(height: 20),
                Text('Requiere atención', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (alertas.isEmpty)
                  const Card(
                    child: ListTile(
                      leading: Icon(Icons.check_circle_rounded, color: AppColors.verde),
                      title: Text('Todo al día'),
                      subtitle: Text('Documentos vigentes, stock suficiente y sin envíos pendientes.'),
                    ),
                  ),
                for (final al in alertas) ...[
                  _TarjetaAlerta(alerta: al),
                  const SizedBox(height: 8),
                ],
                const SizedBox(height: 12),
                Text('Documentos', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      for (final d in a.documentos)
                        ListTile(
                          leading: const Icon(Icons.description_outlined),
                          title: Text(d.nombre),
                          subtitle:
                              Text(d.venceEn == null ? 'Sin vencimiento' : 'Vence el ${formatearFecha(d.venceEn!)}'),
                          trailing: _EstadoDocumento(estado: d.estado),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PorCobrar extends StatelessWidget {
  const _PorCobrar({required this.porCobrar});

  final PorCobrar porCobrar;

  @override
  Widget build(BuildContext context) {
    final p = porCobrar;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(colors: [AppColors.tinta, AppColors.tintaClara]),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Por cobrar', style: TextStyle(color: Colors.white70)),
          Text(formatearClp(p.total),
              style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (p.liquidacionesPendientes > 0)
            Text('${formatearClp(p.liquidacionesPendientes)} en liquidaciones listas para pagar',
                style: const TextStyle(color: Colors.white70)),
          if (p.entregadoSinLiquidar > 0)
            Text('${formatearClp(p.entregadoSinLiquidar)} entregado, entra en el próximo corte',
                style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 10),
          Text('Próxima liquidación: ${_diaSemana.format(p.proximaLiquidacion)}',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          const Text('Cotizapp liquida cada martes lo entregado y confirmado la semana anterior.',
              style: TextStyle(color: Colors.white60, fontSize: 12)),
        ],
      ),
    );
  }
}

class _TarjetaAlerta extends StatelessWidget {
  const _TarjetaAlerta({required this.alerta});

  final Alerta alerta;

  @override
  Widget build(BuildContext context) {
    // Severidad con ícono y etiqueta, no solo color.
    final (color, icono, etiqueta) = switch (alerta.severidad) {
      Severidad.critica => (const Color(0xFFB3261E), Icons.error_rounded, 'Urgente'),
      Severidad.advertencia => (const Color(0xFFB98E00), Icons.warning_amber_rounded, 'Atención'),
      Severidad.informativa => (AppColors.acento, Icons.info_outline_rounded, 'Pendiente'),
    };
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: alerta.irAOrdenes ? () => context.go(Rutas.proveedorOrdenes) : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icono, color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(etiqueta.toUpperCase(),
                        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                    const SizedBox(height: 2),
                    Text(alerta.titulo, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(alerta.detalle, style: const TextStyle(color: AppColors.textoSuave)),
                  ],
                ),
              ),
              if (alerta.irAOrdenes) const Icon(Icons.chevron_right_rounded, color: AppColors.textoSuave),
            ],
          ),
        ),
      ),
    );
  }
}

class _EstadoDocumento extends StatelessWidget {
  const _EstadoDocumento({required this.estado});

  final EstadoDocumento estado;

  @override
  Widget build(BuildContext context) {
    final (texto, color) = switch (estado) {
      EstadoDocumento.alDia => ('Al día', AppColors.verde),
      EstadoDocumento.porVencer => ('Por vencer', const Color(0xFFB98E00)),
      EstadoDocumento.vencido => ('Vencido', const Color(0xFFB3261E)),
    };
    return Text(texto, style: TextStyle(color: color, fontWeight: FontWeight.w700));
  }
}

// Ícono de la pestaña Alertas con la cantidad de avisos.
class IconoAlertas extends ConsumerWidget {
  const IconoAlertas({super.key, this.seleccionado = false});

  final bool seleccionado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = ref.watch(cantidadAlertasProvider);
    final icono = Icon(seleccionado ? Icons.notifications : Icons.notifications_outlined);
    return n == 0 ? icono : Badge(label: Text('$n'), child: icono);
  }
}
