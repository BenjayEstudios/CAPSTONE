import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_providers.dart';
import 'checkout_datasource.dart';

class CheckoutFakeDatasource implements CheckoutDatasource {
  const CheckoutFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});

  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> opcionesEntrega() => llamadaFake(latencia, () => _backend.opcionesEntrega(_usuario()));

  @override
  Future<List<Map<String, dynamic>>> comunas() => llamadaFake(latencia, _backend.comunas);

  @override
  Future<Map<String, dynamic>> confirmar(Map<String, dynamic> body) =>
      llamadaFake(latencia, () => _backend.confirmarCarro(_usuario(), body));

  @override
  Future<Map<String, dynamic>> iniciarPago(int ordenId, Map<String, dynamic> body) =>
      llamadaFake(latencia, () => _backend.iniciarPago(_usuario(), ordenId, body['medioPago'] as String));
}
