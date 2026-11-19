import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/format/formatos.dart';
import '../../../core/network/api_client.dart';
import '../data/alertas_data.dart';
import '../domain/alertas.dart';

final alertasRepositoryProvider = Provider<AlertasRepository>((ref) {
  final AlertasDatasource ds = ref.watch(appConfigProvider).usarFakes
      ? AlertasFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
          latencia: ref.watch(latenciaFakeProvider))
      : AlertasRemoteDatasource(ref.watch(apiClientProvider));
  return AlertasRepositoryImpl(ds);
});

final alertasProveedorProvider = FutureProvider.autoDispose<AlertasProveedor>((ref) {
  return ref.watch(alertasRepositoryProvider).obtener();
});

// Lista "Requiere atención", de lo más grave a lo informativo.
List<Alerta> alertasDe(AlertasProveedor a) {
  final lista = <Alerta>[
    for (final d in a.documentos)
      if (d.estado == EstadoDocumento.vencido)
        Alerta(
          severidad: Severidad.critica,
          titulo: '${d.nombre} vencida',
          detalle: 'Venció el ${formatearFecha(d.venceEn!)}. Súbela de nuevo para seguir publicando ofertas.',
        )
      else if (d.estado == EstadoDocumento.porVencer)
        Alerta(
          severidad: Severidad.advertencia,
          titulo: '${d.nombre} por vencer',
          detalle: 'Vence el ${formatearFecha(d.venceEn!)} (en ${d.diasParaVencer} días).',
        ),
    for (final s in a.stockBajo)
      Alerta(
        severidad: Severidad.advertencia,
        titulo: 'Stock bajo: ${s.producto}',
        detalle: 'Quedan ${s.cajasDisponibles} cajas'
            '${s.cajasIniciales != null ? ' de las ${s.cajasIniciales} que publicaste' : ''}.',
      ),
    if (a.enviosPorDespachar > 0)
      Alerta(
        severidad: Severidad.informativa,
        titulo: a.enviosPorDespachar == 1 ? '1 envío por despachar' : '${a.enviosPorDespachar} envíos por despachar',
        detalle: 'Clientes que ya pagaron y esperan su pedido.',
        irAOrdenes: true,
      ),
  ];
  lista.sort((x, y) => x.severidad.index.compareTo(y.severidad.index));
  return lista;
}

// Para el badge de la pestaña.
final cantidadAlertasProvider = Provider.autoDispose<int>((ref) {
  final a = ref.watch(alertasProveedorProvider).valueOrNull;
  return a == null ? 0 : alertasDe(a).length;
});
