// Orden del listado. "diferencia" pone primero los productos donde más se
// ahorra eligiendo bien el proveedor (sección destacada del inicio).
enum OrdenCatalogo {
  relevancia('relevancia', 'Relevancia'),
  precio('precio', 'Menor precio'),
  diferencia('diferencia', 'Mayor ahorro'),
  nombre('nombre', 'Nombre A-Z');

  const OrdenCatalogo(this.codigo, this.etiqueta);
  final String codigo;
  final String etiqueta;
}

// Filtros del listado (KAN-128). Se traducen 1:1 a los query params de
// GET /productos (ver API_CONTRACT.md). Inmutable: cada cambio crea uno
// nuevo, y Riverpod lo usa como clave del provider de resultados.
class FiltrosCatalogo {
  const FiltrosCatalogo({
    this.texto = '',
    this.categoriaId,
    this.plazoMaxHoras,
    this.cajaChica = false,
    this.orden = OrdenCatalogo.relevancia,
  });

  final String texto;
  final int? categoriaId;
  // 24 o 48: al menos un proveedor entrega en ese plazo.
  final int? plazoMaxHoras;
  // Solo ofertas de hasta 6 unidades por caja (pedidos chicos).
  final bool cajaChica;
  final OrdenCatalogo orden;

  static const maxUnidadesCajaChica = 6;

  // Cuántos filtros (sin contar texto ni orden) están activos, para el badge.
  int get activos => [categoriaId != null, plazoMaxHoras != null, cajaChica].where((a) => a).length;

  FiltrosCatalogo copyWith({
    String? texto,
    int? Function()? categoriaId,
    int? Function()? plazoMaxHoras,
    bool? cajaChica,
    OrdenCatalogo? orden,
  }) {
    return FiltrosCatalogo(
      texto: texto ?? this.texto,
      categoriaId: categoriaId != null ? categoriaId() : this.categoriaId,
      plazoMaxHoras: plazoMaxHoras != null ? plazoMaxHoras() : this.plazoMaxHoras,
      cajaChica: cajaChica ?? this.cajaChica,
      orden: orden ?? this.orden,
    );
  }

  Map<String, dynamic> aQuery({int porPagina = 50}) => {
        if (texto.trim().isNotEmpty) 'q': texto.trim(),
        if (categoriaId != null) 'categoriaId': categoriaId,
        if (plazoMaxHoras != null) 'plazoMaxHoras': plazoMaxHoras,
        if (cajaChica) 'maxUnidadesPorCaja': maxUnidadesCajaChica,
        if (orden != OrdenCatalogo.relevancia) 'orden': orden.codigo,
        'porPagina': porPagina,
      };

  @override
  bool operator ==(Object other) =>
      other is FiltrosCatalogo &&
      other.texto == texto &&
      other.categoriaId == categoriaId &&
      other.plazoMaxHoras == plazoMaxHoras &&
      other.cajaChica == cajaChica &&
      other.orden == orden;

  @override
  int get hashCode => Object.hash(texto, categoriaId, plazoMaxHoras, cajaChica, orden);
}
