// Avisos operativos del distribuidor (KAN-137).

enum EstadoDocumento { alDia, porVencer, vencido }

class DocumentoProveedor {
  const DocumentoProveedor(
      {required this.tipo, required this.venceEn, required this.estado, required this.diasParaVencer});

  // carpeta_tributaria | resolucion_sanitaria
  final String tipo;
  final DateTime? venceEn;
  final EstadoDocumento estado;
  final int? diasParaVencer;

  String get nombre => switch (tipo) {
        'carpeta_tributaria' => 'Carpeta tributaria',
        'resolucion_sanitaria' => 'Resolución sanitaria',
        _ => tipo,
      };
}

class StockBajo {
  const StockBajo(
      {required this.ofertaId, required this.producto, required this.cajasDisponibles, this.cajasIniciales});

  final int ofertaId;
  final String producto;
  final int cajasDisponibles;
  final int? cajasIniciales;
}

class PorCobrar {
  const PorCobrar({
    required this.entregadoSinLiquidar,
    required this.liquidacionesPendientes,
    required this.total,
    required this.proximaLiquidacion,
  });

  // Neto de lo entregado que todavía no entra en un corte semanal.
  final int entregadoSinLiquidar;
  // Neto de cortes ya generados que aún no se pagan.
  final int liquidacionesPendientes;
  final int total;
  final DateTime proximaLiquidacion;
}

class AlertasProveedor {
  const AlertasProveedor({
    required this.documentos,
    required this.stockBajo,
    required this.porCobrar,
    required this.enviosPorDespachar,
  });

  final List<DocumentoProveedor> documentos;
  final List<StockBajo> stockBajo;
  final PorCobrar porCobrar;
  final int enviosPorDespachar;
}

enum Severidad { critica, advertencia, informativa }

// Un aviso para la lista "Requiere atención".
class Alerta {
  const Alerta({required this.severidad, required this.titulo, required this.detalle, this.irAOrdenes = false});

  final Severidad severidad;
  final String titulo;
  final String detalle;
  final bool irAOrdenes;
}

abstract interface class AlertasRepository {
  // GET /alertas/proveedor (pendiente en el backend)
  Future<AlertasProveedor> obtener();
}
