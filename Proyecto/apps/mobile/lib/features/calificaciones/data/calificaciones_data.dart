import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_panel_proveedor.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/parseo.dart';
import '../domain/calificaciones.dart';

abstract interface class CalificacionesDatasource {
  Future<Map<String, dynamic>> recibidas();
}

class CalificacionesRemoteDatasource implements CalificacionesDatasource {
  const CalificacionesRemoteDatasource(this._api);
  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> recibidas() async =>
      Map<String, dynamic>.from(await _api.get('/calificaciones/recibidas') as Map);
}

class CalificacionesFakeDatasource implements CalificacionesDatasource {
  const CalificacionesFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});
  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> recibidas() => llamadaFake(latencia, () => _backend.calificacionesRecibidas(_usuario()));
}

class CalificacionesRepositoryImpl implements CalificacionesRepository {
  const CalificacionesRepositoryImpl(this._datasource);
  final CalificacionesDatasource _datasource;

  @override
  Future<CalificacionesRecibidas> recibidas() async {
    final j = await _datasource.recibidas();
    return parsear(() {
      final r = j['resumen'] as Map<String, dynamic>;
      final dist = r['distribucion'] as Map<String, dynamic>;
      return CalificacionesRecibidas(
        promedio: (r['promedio'] as num?)?.toDouble(),
        cantidad: r['cantidad'] as int,
        distribucion: {for (var p = 1; p <= 5; p++) p: (dist['$p'] as int?) ?? 0},
        entregasATiempoPct: (j['entregasATiempoPct'] as num?)?.toDouble(),
        items: [
          for (final i in j['items'] as List)
            CalificacionRecibida(
              puntaje: i['puntaje'] as int,
              comentario: i['comentario'] as String?,
              ordenCodigo: i['ordenCodigo'] as String,
              cliente: i['cliente'] as String,
              creadaEn: DateTime.parse(i['creadaEn'] as String),
            ),
        ],
      );
    });
  }
}
