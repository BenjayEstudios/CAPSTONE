import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_panel_proveedor.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/parseo.dart';
import '../domain/alertas.dart';

abstract interface class AlertasDatasource {
  Future<Map<String, dynamic>> obtener();
}

class AlertasRemoteDatasource implements AlertasDatasource {
  const AlertasRemoteDatasource(this._api);
  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> obtener() async =>
      Map<String, dynamic>.from(await _api.get('/alertas/proveedor') as Map);
}

class AlertasFakeDatasource implements AlertasDatasource {
  const AlertasFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});
  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> obtener() => llamadaFake(latencia, () => _backend.alertasProveedor(_usuario()));
}

class AlertasRepositoryImpl implements AlertasRepository {
  const AlertasRepositoryImpl(this._datasource);
  final AlertasDatasource _datasource;

  @override
  Future<AlertasProveedor> obtener() async {
    final j = await _datasource.obtener();
    return parsear(() {
      final c = j['porCobrar'] as Map<String, dynamic>;
      return AlertasProveedor(
        documentos: [
          for (final d in j['documentos'] as List)
            DocumentoProveedor(
              tipo: d['tipo'] as String,
              venceEn: d['venceEn'] == null ? null : DateTime.parse('${d['venceEn']}T00:00:00'),
              estado: switch (d['estado']) {
                'vencido' => EstadoDocumento.vencido,
                'por_vencer' => EstadoDocumento.porVencer,
                _ => EstadoDocumento.alDia,
              },
              diasParaVencer: d['diasParaVencer'] as int?,
            ),
        ],
        stockBajo: [
          for (final s in j['stockBajo'] as List)
            StockBajo(
              ofertaId: s['ofertaId'] as int,
              producto: s['producto'] as String,
              cajasDisponibles: s['cajasDisponibles'] as int,
              cajasIniciales: s['cajasIniciales'] as int?,
            ),
        ],
        porCobrar: PorCobrar(
          entregadoSinLiquidar: c['entregadoSinLiquidar'] as int,
          liquidacionesPendientes: c['liquidacionesPendientes'] as int,
          total: c['total'] as int,
          proximaLiquidacion: DateTime.parse('${c['proximaLiquidacion']}T00:00:00'),
        ),
        enviosPorDespachar: j['enviosPorDespachar'] as int? ?? 0,
      );
    });
  }
}
