import 'dart:math' as math;

import '../error/failure.dart';
import 'eventos_sinteticos.dart';
import 'seed.dart';
import 'seed_operacion.dart';

// Backend en memoria para USE_FAKES=true: carro, órdenes, pagos,
// calificaciones, liquidaciones y eventos, cargados desde el seed y
// compartidos por todos los datasources fake. Así lo que hace el comprador
// (confirmar un carro) lo ve el distribuidor (órdenes vigentes) y viceversa
// (avanzar un envío, calificar), igual que contra la API real.
//
// Cada operación devuelve el mismo JSON que el endpoint real (ver
// apps/backend/src/routes/** y packages/application) o, si el endpoint no
// existe, el especificado en API_CONTRACT.md. Los errores salen como los
// Failure que produciría ApiClient con la respuesta de error del backend
// (mismo status, code, mensaje y detalle).
//
// Vive mientras la app esté abierta: reiniciar la app vuelve al seed.

class FakeLinea {
  FakeLinea(this.id, this.ordenEnvioId, this.ofertaId, this.productoId, this.nombreProducto, this.formato,
      this.precioUnitario, this.cantidad);
  final int id, ordenEnvioId, ofertaId, productoId, precioUnitario, cantidad;
  final String nombreProducto;
  final String? formato;
  int get totalLinea => precioUnitario * cantidad;

  Map<String, dynamic> toJson() => {
        'id': id,
        'ordenEnvioId': ordenEnvioId,
        'ofertaId': ofertaId,
        'productoId': productoId,
        'nombreProducto': nombreProducto,
        'formato': formato,
        'precioUnitario': precioUnitario,
        'cantidad': cantidad,
        'totalLinea': totalLinea,
      };
}

class FakeEnvio {
  FakeEnvio({
    required this.id,
    required this.ordenId,
    required this.proveedorId,
    required this.modalidad,
    required this.puntoRetiroId,
    required this.plazoHoras,
    required this.costoDespacho,
    required this.comisionPct,
    required this.estado,
    required this.actualizadoEn,
    required this.lineas,
  });
  final int id, ordenId, proveedorId;
  final String modalidad;
  final int? puntoRetiroId, plazoHoras;
  final int costoDespacho;
  final double comisionPct;
  String estado;
  DateTime actualizadoEn;
  int? liquidacionId;
  final List<FakeLinea> lineas;

  int get subtotal => lineas.fold(0, (s, l) => s + l.totalLinea);
  int get comisionMonto => (subtotal * comisionPct / 100).round();
  int get neto => subtotal + costoDespacho - comisionMonto;
}

class FakeOrden {
  FakeOrden({
    required this.id,
    required this.codigo,
    required this.usuarioId,
    required this.organizacionId,
    required this.direccionEntregaId,
    required this.requiereFactura,
    required this.estado,
    required this.medioPago,
    required this.estadoPago,
    required this.creadaEn,
    required this.pagadoEn,
    required this.envios,
  });
  final int id, usuarioId, organizacionId;
  final String codigo;
  final int? direccionEntregaId;
  final bool requiereFactura;
  String estado, estadoPago;
  String? medioPago, referenciaPasarela;
  final DateTime creadaEn;
  DateTime? pagadoEn;
  final List<FakeEnvio> envios;

  int get subtotal => envios.fold(0, (s, e) => s + e.subtotal);
  int get costoDespachoTotal => envios.fold(0, (s, e) => s + e.costoDespacho);
  int get comisionTotal => envios.fold(0, (s, e) => s + e.comisionMonto);
  int get total => subtotal + costoDespachoTotal;
}

class FakeCalificacion {
  FakeCalificacion(this.id, this.ordenEnvioId, this.usuarioId, this.puntaje, this.comentario, this.creadaEn);
  final int id, ordenEnvioId, usuarioId, puntaje;
  final String? comentario;
  final DateTime creadaEn;
}

class FakeLiquidacion {
  FakeLiquidacion(this.id, this.proveedorId, this.periodoDesde, this.montoNeto, this.estado);
  final int id, proveedorId, montoNeto;
  final DateTime periodoDesde;
  String estado; // pendiente | pagada
}

typedef ItemCarroFake = ({int ofertaId, int cantidad, int precioVisto});

class FakeBackend {
  FakeBackend({DateTime Function()? ahora}) : ahora = ahora ?? DateTime.now {
    _cargarSeed();
  }

  final DateTime Function() ahora;

  final carros = <int, List<ItemCarroFake>>{};
  final carroActualizadoEn = <int, DateTime>{};
  final stock = <int, int>{for (final o in seedOfertas) o.id: o.cajasDisponibles};
  final ordenes = <FakeOrden>[];
  final calificaciones = <FakeCalificacion>[];
  final liquidaciones = <FakeLiquidacion>[];
  final eventos = <EventoSeed>[];
  final direcciones = <({SeedDireccion direccion, int? organizacionId})>[
    for (final d in seedDirecciones)
      (direccion: d, organizacionId: seedDireccionDeCliente.entries.where((e) => e.value == d.id).firstOrNull?.key),
  ];

  // ---------------------------------------------------------------- seed

  void _cargarSeed() {
    final elFogon = seedUsuarioDeCliente[6]!;
    carros[elFogon] = [
      for (final (productoId, proveedorId, cantidad) in seedCarroElFogon)
        (
          ofertaId: seedOfertaDe(productoId, proveedorId).id,
          cantidad: cantidad,
          precioVisto: seedOfertaDe(productoId, proveedorId).precioUnitario,
        ),
    ];

    var envioId = 0, lineaId = 0, califId = 0;
    for (final o in seedOrdenes) {
      final creada = DateTime.parse(o.creadaEn).toUtc();
      final envios = <FakeEnvio>[];
      for (final e in o.envios) {
        envioId++;
        final prov = seedProveedor(e.proveedorId);
        final lineas = [
          for (final (productoId, cantidad) in e.lineas)
            _linea(++lineaId, envioId, seedOfertaDe(productoId, e.proveedorId).id, cantidad),
        ];
        final subtotal = lineas.fold(0, (s, l) => s + l.totalLinea);
        // Retiro no paga despacho; despacho es gratis sobre el umbral del proveedor.
        final costo = e.modalidad == 'retiro' || subtotal >= prov.despachoGratisDesde ? 0 : prov.costoDespachoRM;
        final entregadoEn = creada.add(Duration(hours: prov.plazoHoras));
        envios.add(FakeEnvio(
          id: envioId,
          ordenId: o.id,
          proveedorId: e.proveedorId,
          modalidad: e.modalidad,
          puntoRetiroId: e.puntoRetiroId,
          plazoHoras: prov.plazoHoras,
          costoDespacho: costo,
          comisionPct: seedCondiciones[e.proveedorId]!.comisionPct,
          estado: e.estado,
          actualizadoEn: e.estado == 'entregado' ? entregadoEn : creada.add(const Duration(hours: 2)),
          lineas: lineas,
        ));
        if (e.calificacion case (final puntaje, final comentario)) {
          calificaciones.add(FakeCalificacion(++califId, envioId, seedUsuarioDeCliente[o.clienteId]!, puntaje,
              comentario, entregadoEn.add(Duration(days: 1, hours: envioId % 5))));
        }
      }
      ordenes.add(FakeOrden(
        id: o.id,
        codigo: o.codigo,
        usuarioId: seedUsuarioDeCliente[o.clienteId]!,
        organizacionId: o.clienteId,
        direccionEntregaId: seedDireccionDeCliente[o.clienteId],
        requiereFactura: seedClienteConFactura.contains(o.clienteId),
        estado: o.estado,
        medioPago: o.medioPago,
        estadoPago: 'pagado',
        creadaEn: creada,
        pagadoEn: creada.add(const Duration(minutes: 2)),
        envios: envios,
      )..referenciaPasarela = 'SIM-${o.codigo}');
    }

    // Corte semanal (lun-dom, UTC) de lo entregado por proveedor; el más
    // reciente queda pendiente de pago (seed.ts).
    final cortes = <(int, int), List<FakeEnvio>>{};
    for (final e in ordenes.expand((o) => o.envios).where((e) => e.estado == 'entregado')) {
      final clave = (lunesUtc(e.actualizadoEn).millisecondsSinceEpoch, e.proveedorId);
      (cortes[clave] ??= []).add(e);
    }
    final ultimo = cortes.keys.map((k) => k.$1).reduce(math.max);
    final claves = cortes.keys.toList()..sort((a, b) => a.$1 != b.$1 ? a.$1.compareTo(b.$1) : a.$2.compareTo(b.$2));
    for (final (i, clave) in claves.indexed) {
      final envios = cortes[clave]!;
      for (final e in envios) {
        e.liquidacionId = i + 1;
      }
      liquidaciones.add(FakeLiquidacion(i + 1, clave.$2, DateTime.fromMillisecondsSinceEpoch(clave.$1, isUtc: true),
          envios.fold(0, (s, e) => s + e.neto), clave.$1 == ultimo ? 'pendiente' : 'pagada'));
    }

    eventos.addAll(eventosDelSeed());
  }

  FakeLinea _linea(int id, int envioId, int ofertaId, int cantidad) {
    final o = seedOferta(ofertaId);
    final p = seedProductos.firstWhere((p) => p.id == o.productoId);
    return FakeLinea(id, envioId, ofertaId, p.id, p.nombre, p.formato, o.precioUnitario, cantidad);
  }

  // ------------------------------------------------------------- helpers

  static Never error(int status, String code, String message, [Object? detalle]) {
    throw switch (status) {
      401 => UnauthorizedFailure(message, code: code),
      403 => ForbiddenFailure(message, code: code),
      404 => NotFoundFailure(message, code: code, detalle: detalle),
      400 || 409 || 422 => ValidationFailure(message, code: code, detalle: detalle),
      _ => ServerFailure(message, code: code),
    };
  }

  SeedUsuario usuario(int usuarioId) {
    final u = seedUsuarios.where((u) => u.id == usuarioId).firstOrNull;
    if (u == null || u.estado != 'activo') error(401, 'UNAUTHORIZED', 'Sesion invalida');
    return u;
  }

  SeedOrganizacion organizacionDe(int usuarioId) => seedOrganizacion(usuario(usuarioId).organizacionId);

  static String iso(DateTime d) => d.toUtc().toIso8601String();
  static String fecha(DateTime d) => d.toUtc().toIso8601String().substring(0, 10);

  static DateTime lunesUtc(DateTime d) {
    final dia = DateTime.utc(d.toUtc().year, d.toUtc().month, d.toUtc().day);
    return dia.subtract(Duration(days: dia.weekday - DateTime.monday));
  }

  bool ofertaPublicada(int ofertaId) => seedOferta(ofertaId).estado == 'publicada';

  // ----------------------------------------------------------------- carro

  SeedUsuario _exigirCliente(int usuarioId) {
    final u = usuario(usuarioId);
    if (seedOrganizacion(u.organizacionId).tipo != 'cliente') {
      error(403, 'FORBIDDEN', 'Solo los usuarios cliente tienen carro de compras');
    }
    return u;
  }

  Map<String, dynamic> _carroJson(int usuarioId) {
    final items = carros[usuarioId] ?? const [];
    return {
      'id': items.isEmpty && !carroActualizadoEn.containsKey(usuarioId) ? null : usuarioId,
      'estado': 'abierto',
      'actualizadoEn': carroActualizadoEn[usuarioId] == null ? null : iso(carroActualizadoEn[usuarioId]!),
      'items': [
        for (final i in items)
          () {
            final o = seedOfertas.where((o) => o.id == i.ofertaId).firstOrNull;
            final p = o == null ? null : seedProductos.firstWhere((p) => p.id == o.productoId);
            return {
              'ofertaId': i.ofertaId,
              'cantidad': i.cantidad,
              'precioVisto': i.precioVisto,
              'precioActual': o?.precioUnitario,
              'productoId': o?.productoId,
              'nombreProducto': p?.nombre,
              'formato': p?.formato,
              'proveedorId': o?.proveedorId,
              'disponible': o != null && o.estado == 'publicada',
              'cajasDisponibles': o == null ? null : stock[o.id],
            };
          }(),
      ],
    };
  }

  // GET /carro
  Map<String, dynamic> obtenerCarro(int usuarioId) {
    _exigirCliente(usuarioId);
    return _carroJson(usuarioId);
  }

  // PUT /carro
  Map<String, dynamic> reemplazarCarro(int usuarioId, Map<String, dynamic> body) {
    _exigirCliente(usuarioId);
    final items = [
      for (final i in (body['items'] as List? ?? const []))
        (
          ofertaId: (i as Map)['ofertaId'] as int,
          cantidad: i['cantidad'] as int,
          precioVisto: i['precioVisto'] as int,
        ),
    ];
    if (items.length > 100 || items.any((i) => i.cantidad < 1 || i.cantidad > 100000 || i.precioVisto < 0)) {
      error(400, 'VALIDACION', 'Datos del carro invalidos');
    }
    final ids = items.map((i) => i.ofertaId).toList();
    if (ids.toSet().length != ids.length) error(400, 'ITEM_DUPLICADO', 'Una oferta no puede repetirse en el carro');
    final inexistentes = ids.where((id) => !seedOfertas.any((o) => o.id == id)).toList();
    if (inexistentes.isNotEmpty) {
      error(
          404, 'OFERTA_NO_ENCONTRADA', 'Ofertas inexistentes: ${inexistentes.join(', ')}', {'ofertaIds': inexistentes});
    }
    final noDisponibles = ids.where((id) => !ofertaPublicada(id)).toList();
    if (noDisponibles.isNotEmpty) {
      error(409, 'OFERTA_NO_DISPONIBLE', 'Ofertas no publicadas: ${noDisponibles.join(', ')}',
          {'ofertaIds': noDisponibles});
    }
    carros[usuarioId] = items;
    carroActualizadoEn[usuarioId] = ahora();
    return _carroJson(usuarioId);
  }

  // GET /carro/opciones-entrega (⏳ especificado en API_CONTRACT.md)
  Map<String, dynamic> opcionesEntrega(int usuarioId) {
    final u = _exigirCliente(usuarioId);
    return {
      'direcciones': [
        for (final d in direcciones.where((d) => d.organizacionId == u.organizacionId)) direccionJson(d.direccion),
      ],
      'puntosRetiro': [
        for (final p in seedPuntosRetiro)
          {
            'id': p.id,
            'proveedorId': p.proveedorId,
            'nombre': p.nombre,
            'horario': p.horario,
            'direccion': textoDireccion(seedDireccion(p.direccionId)),
          },
      ],
    };
  }

  static Map<String, dynamic> direccionJson(SeedDireccion d) {
    final c = seedComuna(d.comunaId);
    return {
      'id': d.id,
      'calle': d.calle,
      'numero': d.numero,
      'complemento': d.complemento,
      'referencia': d.referencia,
      'comunaId': c.id,
      'comuna': c.nombre,
      'region': c.regionNombre,
    };
  }

  // "Av. Irarrázaval 3450, Local 2, Ñuñoa"
  static String textoDireccion(SeedDireccion d) => [
        [d.calle, if (d.numero != null) d.numero!].join(' '),
        if (d.complemento != null) d.complemento!,
        seedComuna(d.comunaId).nombre,
      ].join(', ');

  // GET /comunas (⏳)
  List<Map<String, dynamic>> comunas() => [
        for (final c in seedComunas)
          {'id': c.id, 'nombre': c.nombre, 'regionCodigo': c.regionCodigo, 'regionNombre': c.regionNombre},
      ];

  // POST /carro/confirmar: port de confirmarCarro + planificarOrden
  // (packages/application/src/use-cases/carro.use-cases.ts), mismas reglas y
  // mismo orden de validación.
  Map<String, dynamic> confirmarCarro(int usuarioId, Map<String, dynamic> body) {
    final u = _exigirCliente(usuarioId);
    final items = carros[usuarioId] ?? const <ItemCarroFake>[];
    final direccionId = body['direccionId'] as int?;
    final direccionNueva = body['direccion'] as Map<String, dynamic>?;
    final retiros = {
      for (final r in (body['retiros'] as List? ?? const []))
        (r as Map)['proveedorId'] as int: r['puntoRetiroId'] as int,
    };
    final requiereFactura = body['requiereFactura'] as bool? ?? false;

    if (items.isEmpty) error(409, 'CARRO_VACIO', 'El carro esta vacio');
    if (direccionId != null && direccionNueva != null) {
      error(400, 'VALIDACION', 'Indica direccionId o direccion, no ambos');
    }

    final noDisponibles =
        items.where((i) => !ofertaPublicada(i.ofertaId)).map((i) => {'ofertaId': i.ofertaId}).toList();
    if (noDisponibles.isNotEmpty) {
      error(409, 'OFERTA_NO_DISPONIBLE', 'Hay ofertas que ya no estan publicadas', {'lineas': noDisponibles});
    }
    final cambios = [
      for (final i in items)
        if (seedOferta(i.ofertaId).precioUnitario != i.precioVisto)
          {'ofertaId': i.ofertaId, 'precioVisto': i.precioVisto, 'precioActual': seedOferta(i.ofertaId).precioUnitario},
    ];
    if (cambios.isNotEmpty) error(409, 'PRECIO_CAMBIO', 'El precio de algunas ofertas cambio', {'lineas': cambios});

    final bajoMinimo = [
      for (final i in items)
        if (i.cantidad * seedOferta(i.ofertaId).unidadesPorCaja < seedOferta(i.ofertaId).minimoCompra)
          {'ofertaId': i.ofertaId, 'cantidad': i.cantidad, 'minimoCompra': seedOferta(i.ofertaId).minimoCompra},
    ];
    if (bajoMinimo.isNotEmpty) {
      error(409, 'MINIMO_COMPRA', 'Hay lineas bajo el minimo de compra', {'lineas': bajoMinimo});
    }

    final sinStock = [
      for (final i in items)
        if (i.cantidad > stock[i.ofertaId]!)
          {'ofertaId': i.ofertaId, 'solicitado': i.cantidad, 'disponible': stock[i.ofertaId]},
    ];
    if (sinStock.isNotEmpty) error(409, 'SIN_STOCK', 'Stock insuficiente en algunas lineas', {'lineas': sinStock});

    // Agrupa por proveedor respetando el orden de aparición en el carro.
    final grupos = <int, List<ItemCarroFake>>{};
    for (final i in items) {
      (grupos[seedOferta(i.ofertaId).proveedorId] ??= []).add(i);
    }
    SeedComuna? comunaDestino;
    if (direccionId != null) {
      final d = direcciones.where((d) => d.direccion.id == direccionId).firstOrNull;
      if (d != null) comunaDestino = seedComuna(d.direccion.comunaId);
    } else if (direccionNueva != null) {
      final cid = direccionNueva['comunaId'] as int?;
      if (cid != null && cid >= 1 && cid <= seedComunas.length) comunaDestino = seedComuna(cid);
    }
    final necesitaDespacho = grupos.keys.any((pid) => !retiros.containsKey(pid));
    if (necesitaDespacho && comunaDestino == null) {
      error(400, 'DIRECCION_REQUERIDA',
          'Indica una direccion de despacho valida (direccionId o direccion con comunaId existente)');
    }

    final planes = <({
      int proveedorId,
      String modalidad,
      int? puntoRetiroId,
      int? plazoHoras,
      int costo,
      List<ItemCarroFake> items
    })>[];
    final sinCobertura = <Map<String, dynamic>>[];
    for (final MapEntry(key: pid, value: its) in grupos.entries) {
      final org = seedOrganizacion(pid);
      if (org.estado != 'activa') {
        error(409, 'PROVEEDOR_NO_DISPONIBLE', 'El proveedor $pid no esta activo', {'proveedorId': pid});
      }
      final cond = seedCondiciones[pid]!;
      final ofs = its.map((i) => seedOferta(i.ofertaId)).toList();
      final subtotal = its.fold(0, (s, i) => s + seedOferta(i.ofertaId).precioUnitario * i.cantidad);
      final plazoOfertas = ofs.map((o) => o.plazoHoras).reduce(math.max);

      final puntoId = retiros[pid];
      if (puntoId != null) {
        final punto = seedPuntosRetiro.where((p) => p.id == puntoId && p.proveedorId == pid).firstOrNull;
        if (punto == null || !cond.ofreceRetiro || ofs.any((o) => o.modalidadEntrega == 'despacho')) {
          error(409, 'RETIRO_NO_DISPONIBLE', 'El proveedor $pid no permite retiro para este pedido',
              {'proveedorId': pid, 'puntoRetiroId': puntoId});
        }
        planes.add((
          proveedorId: pid,
          modalidad: 'retiro',
          puntoRetiroId: puntoId,
          plazoHoras: plazoOfertas,
          costo: 0,
          items: its
        ));
        continue;
      }
      if (!cond.ofreceDespacho || ofs.any((o) => o.modalidadEntrega == 'retiro')) {
        error(409, 'MODALIDAD_NO_DISPONIBLE', 'El proveedor $pid no despacha este pedido; elige retiro',
            {'proveedorId': pid});
      }
      final dest = comunaDestino!;
      final cob = seedCoberturas.where((c) => c.proveedorId == pid && c.comunaId == dest.id).firstOrNull ??
          seedCoberturas
              .where((c) => c.proveedorId == pid && c.comunaId == null && c.regionCodigo == dest.regionCodigo)
              .firstOrNull;
      if (cob == null) {
        sinCobertura.add({'proveedorId': pid});
        continue;
      }
      final gratis = subtotal >= seedProveedor(pid).despachoGratisDesde;
      planes.add((
        proveedorId: pid,
        modalidad: 'despacho',
        puntoRetiroId: null,
        plazoHoras: math.max(plazoOfertas, cob.plazoHoras),
        costo: gratis ? 0 : cob.costoDespacho,
        items: its,
      ));
    }
    if (sinCobertura.isNotEmpty) {
      error(409, 'SIN_COBERTURA', 'Algun proveedor no despacha a la direccion indicada', {'proveedores': sinCobertura});
    }

    // Persistencia: dirección nueva, orden, envíos, líneas, stock y carro.
    var dirId = direccionId;
    if (direccionNueva != null) {
      dirId = direcciones.map((d) => d.direccion.id).reduce(math.max) + 1;
      direcciones.add((
        direccion: (
          id: dirId,
          comunaId: direccionNueva['comunaId'] as int,
          calle: direccionNueva['calle'] as String,
          numero: direccionNueva['numero'] as String?,
          complemento: direccionNueva['complemento'] as String?,
          referencia: direccionNueva['referencia'] as String?,
        ),
        organizacionId: u.organizacionId,
      ));
    }
    final ordenId = ordenes.map((o) => o.id).reduce(math.max) + 1;
    var envioId = ordenes.expand((o) => o.envios).map((e) => e.id).reduce(math.max);
    var lineaId = ordenes.expand((o) => o.envios).expand((e) => e.lineas).map((l) => l.id).reduce(math.max);
    final creada = ahora().toUtc();
    final envios = [
      for (final p in planes)
        () {
          envioId++;
          return FakeEnvio(
            id: envioId,
            ordenId: ordenId,
            proveedorId: p.proveedorId,
            modalidad: p.modalidad,
            puntoRetiroId: p.puntoRetiroId,
            plazoHoras: p.plazoHoras,
            costoDespacho: p.costo,
            comisionPct: seedCondiciones[p.proveedorId]!.comisionPct,
            estado: 'por_despachar',
            actualizadoEn: creada,
            lineas: [for (final i in p.items) _linea(++lineaId, envioId, i.ofertaId, i.cantidad)],
          );
        }(),
    ];
    final orden = FakeOrden(
      id: ordenId,
      codigo: 'CM-${90000 + ordenId}',
      usuarioId: usuarioId,
      organizacionId: u.organizacionId,
      direccionEntregaId: dirId,
      requiereFactura: requiereFactura,
      estado: 'pendiente_pago',
      medioPago: null,
      estadoPago: 'autorizado',
      creadaEn: creada,
      pagadoEn: null,
      envios: envios,
    );
    ordenes.add(orden);
    for (final i in items) {
      stock[i.ofertaId] = stock[i.ofertaId]! - i.cantidad;
    }
    carros[usuarioId] = [];
    carroActualizadoEn.remove(usuarioId);

    return {
      'ordenId': orden.id,
      'codigo': orden.codigo,
      'estado': 'pendiente_pago',
      'subtotal': orden.subtotal,
      'costoDespachoTotal': orden.costoDespachoTotal,
      'total': orden.total,
      'envios': [
        for (final e in envios)
          {
            'proveedorId': e.proveedorId,
            'modalidad': e.modalidad,
            'plazoHoras': e.plazoHoras,
            'costoDespacho': e.costoDespacho,
            'subtotal': e.subtotal,
            'lineas': [
              for (final l in e.lineas)
                {
                  'ofertaId': l.ofertaId,
                  'productoId': l.productoId,
                  'nombreProducto': l.nombreProducto,
                  'formato': l.formato,
                  'precioUnitario': l.precioUnitario,
                  'cantidad': l.cantidad,
                  'totalLinea': l.totalLinea,
                },
            ],
          },
      ],
    };
  }

  // ----------------------------------------------------------------- pago

  FakeOrden _ordenPropia(int usuarioId, int ordenId) {
    usuario(usuarioId);
    final o = ordenes.where((o) => o.id == ordenId && o.usuarioId == usuarioId).firstOrNull;
    if (o == null) error(404, 'ORDEN_NO_ENCONTRADA', 'Orden no encontrada');
    return o;
  }

  // POST /ordenes/:id/pago (⏳, KAN-148): en el fake la "pasarela" es una
  // pantalla de la app, así que urlPago usa el esquema fake://.
  Map<String, dynamic> iniciarPago(int usuarioId, int ordenId, String medioPago) {
    _exigirCliente(usuarioId);
    final o = _ordenPropia(usuarioId, ordenId);
    if (o.estado != 'pendiente_pago') error(409, 'ORDEN_YA_PAGADA', 'La orden ya fue pagada');
    if (!const ['tarjeta', 'transferencia', 'linea_credito'].contains(medioPago)) {
      error(400, 'VALIDACION', 'medioPago: debe ser tarjeta, transferencia o linea_credito');
    }
    o.medioPago = medioPago;
    return {
      'ordenId': o.id,
      'urlPago': 'fake://pasarela/${o.id}',
      'expiraEn': iso(ahora().add(const Duration(minutes: 15))),
    };
  }

  // Lo que haría el retorno de la pasarela: aprobar o rechazar el pago.
  void resolverPago(int ordenId, {required bool aprobado}) {
    final o = ordenes.firstWhere((o) => o.id == ordenId);
    if (o.estado != 'pendiente_pago') return;
    if (aprobado) {
      o
        ..estado = 'pagada'
        ..estadoPago = 'pagado'
        ..pagadoEn = ahora().toUtc()
        ..referenciaPasarela = 'SIM-${o.codigo}';
    } else {
      o.estadoPago = 'fallido';
    }
  }

  // ------------------------------------------------------------- órdenes

  // Alcance según perfil (resolverAlcance en ordenes.use-cases.ts).
  ({String tipo, int id}) _alcance(int usuarioId) {
    final u = usuario(usuarioId);
    final org = seedOrganizacion(u.organizacionId);
    if (u.rol == 'proveedor' && org.tipo == 'proveedor') return (tipo: 'proveedor', id: org.id);
    if (u.rol == 'comprador' && org.tipo == 'cliente') return (tipo: 'cliente', id: u.id);
    error(403, 'FORBIDDEN', 'No tienes permiso para esto');
  }

  List<FakeEnvio> _enviosVisibles(({String tipo, int id}) a, FakeOrden o) =>
      a.tipo == 'proveedor' ? o.envios.where((e) => e.proveedorId == a.id).toList() : o.envios;

  bool _visible(({String tipo, int id}) a, FakeOrden o) =>
      a.tipo == 'cliente' ? o.usuarioId == a.id : o.envios.any((e) => e.proveedorId == a.id);

  // presentar() de ordenes.use-cases.ts, más los campos aditivos de
  // API_CONTRACT.md (puntoRetiro y calificacion por envío).
  Map<String, dynamic> _presentar(({String tipo, int id}) a, FakeOrden o, {required bool conLineas}) {
    final esCliente = a.tipo == 'cliente';
    final visibles = _enviosVisibles(a, o);
    final dir = o.direccionEntregaId == null
        ? null
        : direcciones.where((d) => d.direccion.id == o.direccionEntregaId).firstOrNull?.direccion;
    final envios = [
      for (final e in visibles)
        {
          'id': e.id,
          'proveedorId': e.proveedorId,
          'proveedorNombre': seedOrganizacion(e.proveedorId).nombre,
          'modalidad': e.modalidad,
          'puntoRetiroId': e.puntoRetiroId,
          'plazoHoras': e.plazoHoras,
          'costoDespacho': e.costoDespacho,
          'subtotal': e.subtotal,
          'comisionPct': esCliente ? null : e.comisionPct.toStringAsFixed(2),
          'comisionMonto': esCliente ? null : e.comisionMonto,
          'montoEnvio': e.subtotal + e.costoDespacho,
          'montoALiquidar': esCliente ? null : e.neto,
          'estado': e.estado,
          'actualizadoEn': iso(e.actualizadoEn),
          if (conLineas) 'lineas': [for (final l in e.lineas) l.toJson()],
          if (conLineas) 'puntoRetiro': _puntoRetiroJson(e.puntoRetiroId),
          if (conLineas && esCliente) 'calificacion': _calificacionJson(e.id),
        },
    ];
    final propio = a.tipo == 'proveedor' ? visibles.first : null;
    return {
      'id': o.id,
      'codigo': o.codigo,
      'estado': o.estado,
      'estadoPago': o.estadoPago,
      'creadaEn': iso(o.creadaEn),
      'pagadoEn': o.pagadoEn == null ? null : iso(o.pagadoEn!),
      'requiereFactura': o.requiereFactura,
      'medioPago': o.medioPago,
      'comuna': dir == null ? null : seedComuna(dir.comunaId).nombre,
      if (!esCliente)
        'cliente': {
          'nombre': seedUsuarios.firstWhere((u) => u.id == o.usuarioId).nombre,
          'organizacion': seedOrganizacion(o.organizacionId).nombre,
        },
      'subtotal': propio?.subtotal ?? o.subtotal,
      'costoDespachoTotal': propio?.costoDespacho ?? o.costoDespachoTotal,
      'comisionTotal': esCliente ? null : (propio?.comisionMonto ?? o.comisionTotal),
      'total': propio == null ? o.total : propio.subtotal + propio.costoDespacho,
      'montoALiquidarTotal':
          esCliente ? null : visibles.where((e) => e.estado != 'cancelado').fold<int>(0, (t, e) => t + e.neto),
      if (conLineas)
        'direccionEntrega': dir == null
            ? null
            : {
                'calle': dir.calle,
                'numero': dir.numero,
                'complemento': dir.complemento,
                'referencia': dir.referencia,
                'comunaNombre': seedComuna(dir.comunaId).nombre,
                'regionNombre': seedComuna(dir.comunaId).regionNombre,
              },
      'envios': envios,
    };
  }

  Map<String, dynamic>? _puntoRetiroJson(int? id) {
    final p = seedPuntosRetiro.where((p) => p.id == id).firstOrNull;
    if (p == null) return null;
    return {
      'id': p.id,
      'nombre': p.nombre,
      'horario': p.horario,
      'direccion': textoDireccion(seedDireccion(p.direccionId))
    };
  }

  Map<String, dynamic>? _calificacionJson(int envioId) {
    final c = calificaciones.where((c) => c.ordenEnvioId == envioId).firstOrNull;
    if (c == null) return null;
    return {'puntaje': c.puntaje, 'comentario': c.comentario, 'creadaEn': iso(c.creadaEn)};
  }

  static const _estadosOrden = ['pendiente_pago', 'pagada', 'en_preparacion', 'despachada', 'entregada', 'reembolsada'];
  static const _estadosEnvio = [
    'por_despachar',
    'en_preparacion',
    'listo_retiro',
    'despachado',
    'entregado',
    'cancelado'
  ];

  // GET /ordenes?estado&pagina&tamano
  Map<String, dynamic> listarOrdenes(int usuarioId, Map<String, dynamic> query) {
    final a = _alcance(usuarioId);
    final estado = query['estado'] as String?;
    final pagina = query['pagina'] as int? ?? 1;
    final tamano = query['tamano'] as int? ?? 20;
    if (estado != null) {
      final validos = a.tipo == 'proveedor' ? _estadosEnvio : _estadosOrden;
      if (!validos.contains(estado)) error(400, 'VALIDACION', 'estado: debe ser uno de ${validos.join(', ')}');
    }
    final todas = ordenes.where((o) => _visible(a, o)).where((o) {
      if (estado == null) return true;
      return a.tipo == 'proveedor' ? _enviosVisibles(a, o).any((e) => e.estado == estado) : o.estado == estado;
    }).toList()
      ..sort((x, y) => y.id.compareTo(x.id));
    return {
      'items': [for (final o in todas.skip((pagina - 1) * tamano).take(tamano)) _presentar(a, o, conLineas: false)],
      'pagina': pagina,
      'tamano': tamano,
      'total': todas.length,
      'totalPaginas': math.max(1, (todas.length / tamano).ceil()),
    };
  }

  // GET /ordenes/:id
  Map<String, dynamic> obtenerOrden(int usuarioId, int ordenId) {
    final a = _alcance(usuarioId);
    final o = ordenes.where((o) => o.id == ordenId && _visible(a, o)).firstOrNull;
    if (o == null) error(404, 'ORDEN_NO_ENCONTRADA', 'Orden no encontrada');
    return _presentar(a, o, conLineas: true);
  }

  // transicionesPermitidas() de ordenes.use-cases.ts.
  static List<String> transicionesPermitidas(String modalidad, String desde) => switch (desde) {
        'por_despachar' => ['en_preparacion', 'cancelado'],
        'en_preparacion' => [modalidad == 'despacho' ? 'despachado' : 'listo_retiro', 'cancelado'],
        'despachado' || 'listo_retiro' => ['entregado'],
        _ => [],
      };

  static String? estadoOrdenDesdeEnvios(List<String> estados) {
    final activos = estados.where((e) => e != 'cancelado').toList();
    if (activos.isEmpty) return null;
    if (activos.every((e) => e == 'entregado')) return 'entregada';
    if (activos.any((e) => e == 'despachado' || e == 'listo_retiro' || e == 'entregado')) return 'despachada';
    if (activos.any((e) => e == 'en_preparacion')) return 'en_preparacion';
    return 'pagada';
  }

  // PATCH /ordenes/envios/:id/estado
  Map<String, dynamic> cambiarEstadoEnvio(int usuarioId, int envioId, Map<String, dynamic> body) {
    final u = usuario(usuarioId);
    final org = seedOrganizacion(u.organizacionId);
    if (!(org.tipo == 'proveedor' && u.rol == 'proveedor')) error(403, 'FORBIDDEN', 'No tienes permiso para esto');
    final nuevo = body['estado'] as String?;
    if (nuevo == null || !_estadosEnvio.contains(nuevo)) {
      error(400, 'VALIDACION', 'estado: debe ser uno de ${_estadosEnvio.join(', ')}');
    }
    final orden = ordenes.where((o) => o.envios.any((e) => e.id == envioId)).firstOrNull;
    final envio = orden?.envios.firstWhere((e) => e.id == envioId);
    // Para un proveedor, un envío ajeno es indistinguible de uno inexistente.
    if (orden == null || envio == null || envio.proveedorId != org.id) {
      error(404, 'ENVIO_NO_ENCONTRADO', 'Envio no encontrado');
    }
    if (orden.estado == 'pendiente_pago') error(409, 'ORDEN_NO_PAGADA', 'La orden aun no esta pagada');
    if (orden.estado == 'reembolsada') error(409, 'ORDEN_REEMBOLSADA', 'La orden fue reembolsada');
    final permitidas = transicionesPermitidas(envio.modalidad, envio.estado);
    if (!permitidas.contains(nuevo)) {
      error(409, 'TRANSICION_INVALIDA', 'No se puede pasar un envio de ${envio.estado} a $nuevo',
          {'desde': envio.estado, 'hacia': nuevo, 'permitidas': permitidas});
    }
    envio
      ..estado = nuevo
      ..actualizadoEn = ahora().toUtc();
    orden.estado = estadoOrdenDesdeEnvios(orden.envios.map((e) => e.estado).toList()) ?? orden.estado;
    return {'id': envio.id, 'ordenId': orden.id, 'estado': envio.estado, 'ordenEstado': orden.estado};
  }

  // ------------------------------------------------------- calificaciones

  // POST /ordenes/envios/:id/calificacion (⏳, KAN-142): mismas reglas que
  // DrizzleCalificacionRepository.registrar.
  Map<String, dynamic> calificarEnvio(int usuarioId, int envioId, Map<String, dynamic> body) {
    final u = _exigirCliente(usuarioId);
    final puntaje = body['puntaje'];
    final comentario = (body['comentario'] as String?)?.trim();
    if (puntaje is! int || puntaje < 1 || puntaje > 5) {
      error(400, 'VALIDACION', 'puntaje: debe ser un entero entre 1 y 5');
    }
    if (comentario != null && comentario.length > 500) error(400, 'VALIDACION', 'comentario: maximo 500 caracteres');
    final orden = ordenes.where((o) => o.envios.any((e) => e.id == envioId)).firstOrNull;
    final envio = orden?.envios.firstWhere((e) => e.id == envioId);
    if (orden == null || envio == null || orden.organizacionId != u.organizacionId || envio.estado != 'entregado') {
      error(409, 'ENVIO_NO_CALIFICABLE', 'Solo se puede calificar un envio entregado de tu organizacion');
    }
    if (calificaciones.any((c) => c.ordenEnvioId == envioId)) {
      error(409, 'YA_CALIFICADO', 'Este envio ya fue calificado');
    }
    final c = FakeCalificacion(calificaciones.map((c) => c.id).fold(0, math.max) + 1, envioId, usuarioId, puntaje,
        (comentario?.isEmpty ?? true) ? null : comentario, ahora().toUtc());
    calificaciones.add(c);
    return {
      'id': c.id,
      'ordenEnvioId': c.ordenEnvioId,
      'usuarioId': c.usuarioId,
      'puntaje': c.puntaje,
      'comentario': c.comentario,
      'creadaEn': iso(c.creadaEn),
    };
  }

  // -------------------------------------------------------------- eventos

  // POST /eventos/lote: valida como eventoLoteSchema (1 a 20, claves en
  // snake_case) y guarda. La API responde 202 sin cuerpo.
  void registrarEventos(Map<String, dynamic> body) {
    final lista = body['eventos'] as List? ?? const [];
    if (lista.isEmpty || lista.length > 20) error(400, 'VALIDACION', 'eventos: entre 1 y 20');
    for (final raw in lista) {
      final e = raw as Map<String, dynamic>;
      eventos.add((
        tipo: e['tipo_evento'] as String,
        creadoEn: ahora().toUtc(),
        productoId: e['producto_id'] as int?,
        ofertaId: e['oferta_id'] as int?,
        comunaId: e['comuna_id'] as int?,
        origen: e['origen'] as String?,
        convirtio: e['convirtio'] as bool?,
        termino: e['termino'] as String?,
        resultados: e['resultados'] as int?,
      ));
    }
  }
}
