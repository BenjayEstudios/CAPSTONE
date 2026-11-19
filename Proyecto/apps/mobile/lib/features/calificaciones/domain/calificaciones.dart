// Calificaciones que recibió el distribuidor (KAN-135).

class CalificacionRecibida {
  const CalificacionRecibida({
    required this.puntaje,
    required this.comentario,
    required this.ordenCodigo,
    required this.cliente,
    required this.creadaEn,
  });

  final int puntaje;
  final String? comentario;
  final String ordenCodigo;
  final String cliente;
  final DateTime creadaEn;
}

class CalificacionesRecibidas {
  const CalificacionesRecibidas({
    required this.promedio,
    required this.cantidad,
    required this.distribucion,
    required this.entregasATiempoPct,
    required this.items,
  });

  // null sin calificaciones.
  final double? promedio;
  final int cantidad;
  // puntaje (1-5) -> cantidad
  final Map<int, int> distribucion;
  final double? entregasATiempoPct;
  final List<CalificacionRecibida> items;
}

abstract interface class CalificacionesRepository {
  // GET /calificaciones/recibidas (pendiente en el backend)
  Future<CalificacionesRecibidas> recibidas();
}
