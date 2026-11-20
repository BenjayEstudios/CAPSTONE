import '../../../core/network/parseo.dart';
import '../../ordenes/domain/orden.dart';
import '../domain/checkout.dart';
import '../domain/checkout_repository.dart';
import 'checkout_datasource.dart';

class CheckoutRepositoryImpl implements CheckoutRepository {
  const CheckoutRepositoryImpl(this._datasource);

  final CheckoutDatasource _datasource;

  @override
  Future<OpcionesEntrega> opcionesEntrega() async {
    final j = await _datasource.opcionesEntrega();
    return parsear(() => OpcionesEntrega(
          direcciones: [
            for (final d in j['direcciones'] as List)
              DireccionEntrega(
                id: d['id'] as int,
                calle: d['calle'] as String,
                numero: d['numero'] as String?,
                complemento: d['complemento'] as String?,
                referencia: d['referencia'] as String?,
                comunaId: d['comunaId'] as int,
                comuna: d['comuna'] as String,
              ),
          ],
          puntosRetiro: [
            for (final p in j['puntosRetiro'] as List)
              PuntoRetiro(
                id: p['id'] as int,
                proveedorId: p['proveedorId'] as int,
                nombre: p['nombre'] as String,
                direccion: p['direccion'] as String,
                horario: p['horario'] as String?,
              ),
          ],
        ));
  }

  @override
  Future<List<Comuna>> comunas() async {
    final lista = await _datasource.comunas();
    return parsear(() => [
          for (final c in lista)
            Comuna(id: c['id'] as int, nombre: c['nombre'] as String, regionNombre: c['regionNombre'] as String),
        ]);
  }

  @override
  Future<OrdenCreada> confirmar(PedidoCheckout pedido) async {
    final j = await _datasource.confirmar(pedido.toJson());
    return parsear(() => OrdenCreada(
          ordenId: j['ordenId'] as int,
          codigo: j['codigo'] as String,
          subtotal: j['subtotal'] as int,
          costoDespachoTotal: j['costoDespachoTotal'] as int,
          total: j['total'] as int,
        ));
  }

  @override
  Future<InicioPago> iniciarPago(int ordenId, MedioPago medio) async {
    final j = await _datasource.iniciarPago(ordenId, {'medioPago': medio.codigo, 'urlRetorno': urlRetornoPago});
    return parsear(() => InicioPago(ordenId: j['ordenId'] as int, urlPago: j['urlPago'] as String));
  }
}

// Adónde vuelve la pasarela. La app no registra este esquema todavía: el
// usuario vuelve a mano y la pantalla de resultado consulta la orden.
const urlRetornoPago = 'cotizapp://pago';
