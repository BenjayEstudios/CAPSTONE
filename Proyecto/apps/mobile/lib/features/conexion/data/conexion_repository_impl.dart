import '../../../core/network/parseo.dart';
import '../domain/conexion_repository.dart';
import '../domain/estado_backend.dart';
import 'conexion_remote_datasource.dart';

class ConexionRepositoryImpl implements ConexionRepository {
  const ConexionRepositoryImpl(this._datasource);

  final ConexionRemoteDatasource _datasource;

  @override
  Future<EstadoBackend> verificar() async {
    final json = await _datasource.healthCheck();
    return parsear(() {
      final timestamp = json['timestamp'] as String?;
      return EstadoBackend(
        ok: json['status'] == 'ok',
        horaServidor: timestamp != null ? DateTime.tryParse(timestamp) : null,
      );
    });
  }
}
