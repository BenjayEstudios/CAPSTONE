import '../../../core/network/parseo.dart';
import '../domain/orden.dart';
import '../domain/ordenes_repository.dart';
import 'ordenes_datasource.dart';

class OrdenesRepositoryImpl implements OrdenesRepository {
  const OrdenesRepositoryImpl(this._datasource);

  final OrdenesDatasource _datasource;

  @override
  Future<PaginaOrdenes> listar({String? estado, int pagina = 1, int tamano = 50}) async {
    final json = await _datasource.listar({if (estado != null) 'estado': estado, 'pagina': pagina, 'tamano': tamano});
    return parsear(() => PaginaOrdenes(
          items: [for (final o in json['items'] as List) ordenDesdeJson(Map<String, dynamic>.from(o as Map))],
          total: json['total'] as int,
        ));
  }

  @override
  Future<Orden> obtener(int id) async {
    final json = await _datasource.obtener(id);
    return parsear(() => ordenDesdeJson(json));
  }

  @override
  Future<({EstadoEnvio envio, EstadoOrden orden})> cambiarEstadoEnvio(int envioId, EstadoEnvio estado) async {
    final json = await _datasource.cambiarEstadoEnvio(envioId, {'estado': estado.codigo});
    return parsear(() => (
          envio: EstadoEnvio.desdeCodigo(json['estado'] as String),
          orden: EstadoOrden.desdeCodigo(json['ordenEstado'] as String),
        ));
  }

  @override
  Future<void> calificarEnvio(int envioId, {required int puntaje, String? comentario}) async {
    await _datasource.calificarEnvio(envioId, {
      'puntaje': puntaje,
      if (comentario != null && comentario.trim().isNotEmpty) 'comentario': comentario.trim(),
    });
  }
}

Orden ordenDesdeJson(Map<String, dynamic> j) {
  final cliente = j['cliente'] as Map<String, dynamic>?;
  final dir = j['direccionEntrega'] as Map<String, dynamic>?;
  return Orden(
    id: j['id'] as int,
    codigo: j['codigo'] as String,
    estado: EstadoOrden.desdeCodigo(j['estado'] as String),
    estadoPago: j['estadoPago'] as String,
    creadaEn: DateTime.parse(j['creadaEn'] as String),
    pagadoEn: j['pagadoEn'] == null ? null : DateTime.parse(j['pagadoEn'] as String),
    requiereFactura: j['requiereFactura'] as bool? ?? false,
    medioPago: MedioPago.desdeCodigo(j['medioPago'] as String?),
    comuna: j['comuna'] as String?,
    clienteNombre: cliente?['nombre'] as String?,
    clienteOrganizacion: cliente?['organizacion'] as String?,
    subtotal: j['subtotal'] as int,
    costoDespachoTotal: j['costoDespachoTotal'] as int,
    total: j['total'] as int,
    montoALiquidarTotal: j['montoALiquidarTotal'] as int?,
    direccion: dir == null
        ? null
        : DireccionOrden(
            texto: [
              [dir['calle'], if (dir['numero'] != null) dir['numero']].join(' '),
              if (dir['complemento'] != null) dir['complemento'],
            ].join(', '),
            comuna: dir['comunaNombre'] as String,
            referencia: dir['referencia'] as String?,
          ),
    envios: [for (final e in j['envios'] as List) _envioDesdeJson(Map<String, dynamic>.from(e as Map))],
  );
}

EnvioOrden _envioDesdeJson(Map<String, dynamic> j) {
  final punto = j['puntoRetiro'] as Map<String, dynamic>?;
  final calificacion = j['calificacion'] as Map<String, dynamic>?;
  return EnvioOrden(
    id: j['id'] as int,
    proveedorId: j['proveedorId'] as int,
    proveedorNombre: j['proveedorNombre'] as String,
    esRetiro: j['modalidad'] == 'retiro',
    plazoHoras: j['plazoHoras'] as int?,
    costoDespacho: j['costoDespacho'] as int? ?? 0,
    subtotal: j['subtotal'] as int,
    montoEnvio: j['montoEnvio'] as int? ?? (j['subtotal'] as int) + (j['costoDespacho'] as int? ?? 0),
    montoALiquidar: j['montoALiquidar'] as int?,
    estado: EstadoEnvio.desdeCodigo(j['estado'] as String),
    actualizadoEn: DateTime.parse(j['actualizadoEn'] as String),
    lineas: [
      for (final l in (j['lineas'] as List? ?? const []))
        LineaOrden(
          ofertaId: l['ofertaId'] as int,
          productoId: l['productoId'] as int,
          nombreProducto: l['nombreProducto'] as String,
          formato: l['formato'] as String?,
          precioUnitario: l['precioUnitario'] as int,
          cantidad: l['cantidad'] as int,
          totalLinea: l['totalLinea'] as int,
        ),
    ],
    puntoRetiro: punto == null
        ? null
        : PuntoRetiroOrden(
            nombre: punto['nombre'] as String,
            direccion: punto['direccion'] as String,
            horario: punto['horario'] as String?,
          ),
    calificacion: calificacion == null
        ? null
        : CalificacionEnvio(puntaje: calificacion['puntaje'] as int, comentario: calificacion['comentario'] as String?),
    calificacionConocida: j.containsKey('calificacion'),
  );
}
