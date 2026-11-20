import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/format/formatos.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../../core/widgets/graficos.dart';
import '../data/calificaciones_data.dart';
import '../domain/calificaciones.dart';

final calificacionesRepositoryProvider = Provider<CalificacionesRepository>((ref) {
  final CalificacionesDatasource ds = ref.watch(appConfigProvider).usarFakes
      ? CalificacionesFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
          latencia: ref.watch(latenciaFakeProvider))
      : CalificacionesRemoteDatasource(ref.watch(apiClientProvider));
  return CalificacionesRepositoryImpl(ds);
});

final calificacionesRecibidasProvider = FutureProvider.autoDispose<CalificacionesRecibidas>((ref) {
  return ref.watch(calificacionesRepositoryProvider).recibidas();
});

// Pestaña Reseñas del distribuidor (KAN-135): promedio, distribución de
// puntajes, % de entregas a tiempo y las calificaciones con su comentario.
class CalificacionesPage extends ConsumerWidget {
  const CalificacionesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(calificacionesRecibidasProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Reseñas')),
      body: AsyncValueView(
        value: datos,
        onReintentar: () => ref.invalidate(calificacionesRecibidasProvider),
        data: (c) => RefreshIndicator(
          onRefresh: () => ref.refresh(calificacionesRecibidasProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _Resumen(datos: c),
              const SizedBox(height: 16),
              Text(c.items.isEmpty ? 'Todavía no tienes calificaciones' : 'Lo que dicen tus clientes',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final i in c.items) ...[
                _TarjetaCalificacion(calificacion: i),
                const SizedBox(height: 8),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class Estrellas extends StatelessWidget {
  const Estrellas({super.key, required this.puntaje, this.tamano = 16});

  final num puntaje;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Icon(
            puntaje >= i
                ? Icons.star_rounded
                : (puntaje >= i - 0.5 ? Icons.star_half_rounded : Icons.star_outline_rounded),
            size: tamano,
            color: AppColors.amarillo,
          ),
      ],
    );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({required this.datos});

  final CalificacionesRecibidas datos;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final promedio = datos.promedio;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(promedio == null ? '—' : formatearPromedio(promedio),
                    style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w700, height: 1)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Estrellas(puntaje: promedio ?? 0, tamano: 22),
                      const SizedBox(height: 4),
                      Text(
                        datos.cantidad == 1 ? '1 calificación' : '${datos.cantidad} calificaciones',
                        style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            BarrasHorizontales(
              maximo: datos.cantidad == 0 ? 1 : datos.cantidad,
              filas: [
                for (var p = 5; p >= 1; p--)
                  (
                    etiqueta: '$p ${p == 1 ? 'estrella' : 'estrellas'}',
                    valor: datos.distribucion[p] ?? 0,
                    texto: '${datos.distribucion[p] ?? 0}',
                    nota: null,
                  ),
              ],
            ),
            if (datos.entregasATiempoPct != null) ...[
              const Divider(height: 28),
              Row(
                children: [
                  const Icon(Icons.schedule_rounded, color: AppColors.acento),
                  const SizedBox(width: 10),
                  const Expanded(child: Text('Entregas a tiempo')),
                  Text('${formatearPromedio(datos.entregasATiempoPct!)}%',
                      style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: datos.entregasATiempoPct! / 100,
                  minHeight: 8,
                  color: AppColors.acento,
                  backgroundColor: AppColors.acento.withValues(alpha: 0.12),
                ),
              ),
              const SizedBox(height: 6),
              Text('Envíos entregados dentro del plazo que prometiste.',
                  style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
            ],
          ],
        ),
      ),
    );
  }
}

class _TarjetaCalificacion extends StatelessWidget {
  const _TarjetaCalificacion({required this.calificacion});

  final CalificacionRecibida calificacion;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Estrellas(puntaje: calificacion.puntaje),
                const Spacer(),
                Text(formatearFecha(calificacion.creadaEn),
                    style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              calificacion.comentario ?? 'Sin comentario',
              style: calificacion.comentario == null
                  ? textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave, fontStyle: FontStyle.italic)
                  : textTheme.bodyMedium,
            ),
            const SizedBox(height: 6),
            Text('${calificacion.cliente} · orden ${calificacion.ordenCodigo}',
                style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
          ],
        ),
      ),
    );
  }
}
