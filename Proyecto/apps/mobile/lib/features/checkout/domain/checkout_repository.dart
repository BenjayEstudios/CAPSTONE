import '../../ordenes/domain/orden.dart';
import 'checkout.dart';

abstract interface class CheckoutRepository {
  // GET /carro/opciones-entrega (pendiente en el backend)
  Future<OpcionesEntrega> opcionesEntrega();

  // GET /comunas (pendiente en el backend)
  Future<List<Comuna>> comunas();

  // POST /carro/confirmar: crea la orden pendiente de pago y vacía el carro.
  // Los 409 de negocio (PRECIO_CAMBIO, SIN_STOCK, SIN_COBERTURA, ...) suben
  // como ValidationFailure con su code y detalle.
  Future<OrdenCreada> confirmar(PedidoCheckout pedido);

  // POST /ordenes/:id/pago (pendiente, KAN-148)
  Future<InicioPago> iniciarPago(int ordenId, MedioPago medio);
}
