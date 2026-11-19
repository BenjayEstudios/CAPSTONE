import 'orden.dart';

abstract interface class OrdenesRepository {
  // GET /ordenes?estado&pagina&tamano. estado filtra la orden (cliente) o el
  // envío (proveedor).
  Future<PaginaOrdenes> listar({String? estado, int pagina = 1, int tamano = 50});

  // GET /ordenes/:id, con líneas y dirección.
  Future<Orden> obtener(int id);

  // PATCH /ordenes/envios/:id/estado. Devuelve el estado nuevo del envío y
  // el de la orden recalculado.
  Future<({EstadoEnvio envio, EstadoOrden orden})> cambiarEstadoEnvio(int envioId, EstadoEnvio estado);

  // POST /ordenes/envios/:id/calificacion (pendiente en el backend).
  Future<void> calificarEnvio(int envioId, {required int puntaje, String? comentario});
}
