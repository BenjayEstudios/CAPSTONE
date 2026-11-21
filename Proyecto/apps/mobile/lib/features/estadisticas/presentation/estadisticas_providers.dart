import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../data/estadisticas_datasource.dart';
import '../data/estadisticas_fake_datasource.dart';
import '../data/estadisticas_remote_datasource.dart';
import '../data/estadisticas_repository_impl.dart';
import '../domain/estadisticas.dart';
import '../domain/estadisticas_repository.dart';

final estadisticasDatasourceProvider = Provider<EstadisticasDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) {
    return EstadisticasFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
        latencia: ref.watch(latenciaFakeProvider));
  }
  return EstadisticasRemoteDatasource(ref.watch(apiClientProvider));
});

final estadisticasRepositoryProvider = Provider<EstadisticasRepository>((ref) {
  return EstadisticasRepositoryImpl(ref.watch(estadisticasDatasourceProvider));
});

DateTime _soloDia(DateTime d) => DateTime(d.year, d.month, d.day);

// KPIs de un mes (día 1) contra el anterior. Si es el mes en curso, se
// compara el mismo tramo (1 al día de hoy) del mes anterior, como el mockup.
final comparacionMensualProvider = FutureProvider.autoDispose.family<ComparacionMensual, DateTime>((ref, mes) async {
  final hoy = _soloDia(ref.watch(ahoraProvider)());
  final repo = ref.watch(estadisticasRepositoryProvider);
  final finMes = DateTime(mes.year, mes.month + 1, 0);
  final corte = finMes.isAfter(hoy) ? hoy : finMes;
  final inicioAnterior = DateTime(mes.year, mes.month - 1, 1);
  final finAnterior = DateTime(mes.year, mes.month, 0);
  final corteAnterior = corte == finMes
      ? finAnterior
      : DateTime(inicioAnterior.year, inicioAnterior.month, corte.day > finAnterior.day ? finAnterior.day : corte.day);
  final (actual, anterior) = await (
    repo.ventas(desde: mes, hasta: corte),
    repo.ventas(desde: inicioAnterior, hasta: corteAnterior),
  ).wait;
  return ComparacionMensual(mes: mes, actual: actual.totales, anterior: anterior.totales, corte: corte);
});

// Últimas 12 semanas (de lunes a hoy): venta semanal y productos más vendidos.
final ventas12SemanasProvider = FutureProvider.autoDispose<ResumenVentas>((ref) {
  final hoy = _soloDia(ref.watch(ahoraProvider)());
  final lunes = hoy.subtract(Duration(days: hoy.weekday - DateTime.monday));
  return ref
      .watch(estadisticasRepositoryProvider)
      .ventas(desde: lunes.subtract(const Duration(days: 7 * 11)), hasta: hoy);
});

// Visitas de los últimos N días (30 por defecto, como pide KAN-134).
final visitasProvider = FutureProvider.autoDispose.family<Visitas, int>((ref, dias) {
  final hoy = _soloDia(ref.watch(ahoraProvider)());
  return ref.watch(estadisticasRepositoryProvider).visitas(desde: hoy.subtract(Duration(days: dias - 1)), hasta: hoy);
});
