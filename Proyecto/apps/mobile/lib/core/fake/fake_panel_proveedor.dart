import 'fake_backend.dart';
import 'seed.dart';
import 'seed_operacion.dart';

// Panel del distribuidor sobre FakeBackend: estadísticas de visitas (endpoint
// real), ventas, calificaciones recibidas y alertas (especificados en
// API_CONTRACT.md). Mismas reglas de conteo que packages/application y
// packages/infrastructure.

// Umbrales de las alertas (KAN-137). Decisión abierta: ver
// docs/decisiones/DECISIONES-ABIERTAS.md.
const umbralStockBajoCajas = 20;
const diasAvisoVencimiento = 45;

extension PanelProveedor on FakeBackend {
  int _proveedorDe(int usuarioId) {
    final u = usuario(usuarioId);
    final org = seedOrganizacion(u.organizacionId);
    if (org.tipo != 'proveedor' || u.rol != 'proveedor') {
      FakeBackend.error(403, 'FORBIDDEN', 'No tienes permiso para esto');
    }
    return org.id;
  }

  // resolverRango() de eventos-analiticos.use-cases.ts: desde/hasta
  // inclusivos (UTC), por defecto los últimos 30 días, máximo 366.
  ({String desde, String hasta, List<String> dias}) _rango(Map<String, dynamic> query) {
    final hoy = FakeBackend.fecha(ahora());
    final qDesde = query['desde'] as String?;
    final qHasta = query['hasta'] as String?;
    final hasta = qHasta ?? (qDesde != null && qDesde.compareTo(hoy) > 0 ? qDesde : hoy);
    final desde = qDesde ?? FakeBackend.fecha(DateTime.parse('${hasta}T00:00:00Z').subtract(const Duration(days: 29)));
    if (desde.compareTo(hasta) > 0) FakeBackend.error(400, 'VALIDACION', 'hasta: hasta no puede ser anterior a desde');
    final ini = DateTime.parse('${desde}T00:00:00Z');
    final n = DateTime.parse('${hasta}T00:00:00Z').difference(ini).inDays + 1;
    if (n > 366) FakeBackend.error(400, 'VALIDACION', 'El rango maximo es de 366 dias');
    return (
      desde: desde,
      hasta: hasta,
      dias: [for (var i = 0; i < n; i++) FakeBackend.fecha(ini.add(Duration(days: i)))]
    );
  }

  static double _conversion(int vistas, int clicks) => vistas > 0 ? (clicks / vistas * 10000).round() / 10000 : 0;

  // GET /estadisticas/proveedor?desde&hasta (existe: estadisticasProveedor
  // en eventos-analiticos.use-cases.ts), más el campo aditivo porComuna.
  Map<String, dynamic> estadisticasProveedor(int usuarioId, Map<String, dynamic> query) {
    final proveedorId = _proveedorDe(usuarioId);
    final r = _rango(query);
    final enRango = r.dias.toSet();
    // Una oferta por producto y proveedor (ux_oferta_producto_proveedor).
    final ofertas = {for (final o in seedOfertas.where((o) => o.proveedorId == proveedorId)) o.productoId: o};
    final idsOferta = ofertas.values.map((o) => o.id).toSet();

    Map<String, ({int vistas, int clicks})> vacio() => {for (final d in r.dias) d: (vistas: 0, clicks: 0)};
    final total = vacio();
    final porOferta = <int, Map<String, ({int vistas, int clicks})>>{};
    final porComuna = <int, ({int vistas, int clicks})>{};

    for (final e in eventos) {
      final dia = FakeBackend.fecha(e.creadoEn);
      if (!enRango.contains(dia)) continue;
      final esVista = e.tipo == 'vista_producto' && ofertas.containsKey(e.productoId);
      final esClick = e.tipo == 'click_oferta' && idsOferta.contains(e.ofertaId);
      if (!esVista && !esClick) continue;
      final oferta = esVista ? ofertas[e.productoId]! : seedOferta(e.ofertaId!);
      final serie = porOferta.putIfAbsent(oferta.id, vacio);
      for (final m in [total, serie]) {
        final f = m[dia]!;
        m[dia] = esVista ? (vistas: f.vistas + 1, clicks: f.clicks) : (vistas: f.vistas, clicks: f.clicks + 1);
      }
      if (e.comunaId != null) {
        final c = porComuna[e.comunaId!] ?? (vistas: 0, clicks: 0);
        porComuna[e.comunaId!] =
            esVista ? (vistas: c.vistas + 1, clicks: c.clicks) : (vistas: c.vistas, clicks: c.clicks + 1);
      }
    }

    ({int vistas, int clicks}) suma(Map<String, ({int vistas, int clicks})> m) =>
        m.values.fold((vistas: 0, clicks: 0), (a, f) => (vistas: a.vistas + f.vistas, clicks: a.clicks + f.clicks));
    List<Map<String, dynamic>> serieJson(Map<String, ({int vistas, int clicks})> m) => [
          for (final MapEntry(key: fecha, value: f) in m.entries)
            {'fecha': fecha, 'vistas': f.vistas, 'clicks': f.clicks},
        ];

    final t = suma(total);
    final filas = [
      for (final MapEntry(key: ofertaId, value: serie) in porOferta.entries)
        () {
          final o = seedOferta(ofertaId);
          final s = suma(serie);
          return {
            'ofertaId': ofertaId,
            'productoId': o.productoId,
            'producto': seedProductos.firstWhere((p) => p.id == o.productoId).nombre,
            'vistas': s.vistas,
            'clicks': s.clicks,
            'conversionVistaClick': _conversion(s.vistas, s.clicks),
            'porDia': serieJson(serie),
          };
        }(),
    ]..sort((a, b) {
        final c = (b['vistas'] as int).compareTo(a['vistas'] as int);
        return c != 0 ? c : (a['ofertaId'] as int).compareTo(b['ofertaId'] as int);
      });

    final coberturas = seedCoberturas.where((c) => c.proveedorId == proveedorId).toList();
    bool cubre(int comunaId) {
      final comuna = seedComuna(comunaId);
      return coberturas
          .any((c) => c.comunaId == comunaId || (c.comunaId == null && c.regionCodigo == comuna.regionCodigo));
    }

    return {
      'desde': r.desde,
      'hasta': r.hasta,
      'totales': {'vistas': t.vistas, 'clicks': t.clicks},
      'conversionVistaClick': _conversion(t.vistas, t.clicks),
      'porDia': serieJson(total),
      'porOferta': filas,
      'porComuna': [
        for (final MapEntry(key: comunaId, value: c)
            in porComuna.entries.toList()..sort((a, b) => b.value.vistas.compareTo(a.value.vistas)))
          {
            'comunaId': comunaId,
            'comuna': seedComuna(comunaId).nombre,
            'vistas': c.vistas,
            'clicks': c.clicks,
            'cubre': cubre(comunaId),
          },
      ],
    };
  }

  // GET /estadisticas/proveedor/ventas?desde&hasta (⏳): ventasPorSemana y
  // ventasPorProducto de DrizzleAnaliticaRepository. Venta = envío no
  // cancelado de una orden pagada, fechado por orden.creada_en.
  Map<String, dynamic> ventasProveedor(int usuarioId, Map<String, dynamic> query) {
    final proveedorId = _proveedorDe(usuarioId);
    final r = _rango(query);
    final ini = DateTime.parse('${r.desde}T00:00:00Z');
    final finExclusivo = DateTime.parse('${r.hasta}T00:00:00Z').add(const Duration(days: 1));

    final ventas = [
      for (final o in ordenes)
        if (o.estadoPago == 'pagado' && !o.creadaEn.isBefore(ini) && o.creadaEn.isBefore(finExclusivo))
          for (final e in o.envios)
            if (e.proveedorId == proveedorId && e.estado != 'cancelado') (orden: o, envio: e),
    ];

    final semanas = <Map<String, dynamic>>[];
    for (var lunes = FakeBackend.lunesUtc(ini);
        lunes.isBefore(finExclusivo);
        lunes = lunes.add(const Duration(days: 7))) {
      final fin = lunes.add(const Duration(days: 7));
      final deLaSemana = ventas.where((v) => !v.orden.creadaEn.isBefore(lunes) && v.orden.creadaEn.isBefore(fin));
      final monto = deLaSemana.fold(0, (s, v) => s + v.envio.subtotal);
      final despacho = deLaSemana.fold(0, (s, v) => s + v.envio.costoDespacho);
      final comision = deLaSemana.fold(0, (s, v) => s + v.envio.comisionMonto);
      semanas.add({
        'semana': FakeBackend.fecha(lunes),
        'envios': deLaSemana.length,
        'ventas': monto,
        'despacho': despacho,
        'comision': comision,
        'neto': monto + despacho - comision,
      });
    }

    final porProducto = <int, ({String nombre, int unidades, int ventas})>{};
    for (final v in ventas) {
      for (final l in v.envio.lineas) {
        final p = porProducto[l.productoId] ?? (nombre: l.nombreProducto, unidades: 0, ventas: 0);
        porProducto[l.productoId] =
            (nombre: p.nombre, unidades: p.unidades + l.cantidad, ventas: p.ventas + l.totalLinea);
      }
    }
    final productos = porProducto.entries.toList()
      ..sort((a, b) {
        final c = b.value.ventas.compareTo(a.value.ventas);
        return c != 0 ? c : a.key.compareTo(b.key);
      });

    int sumar(String campo) => semanas.fold(0, (s, w) => s + (w[campo] as int));
    return {
      'desde': r.desde,
      'hasta': r.hasta,
      'totales': {
        'envios': sumar('envios'),
        'ventas': sumar('ventas'),
        'despacho': sumar('despacho'),
        'comision': sumar('comision'),
        'neto': sumar('neto'),
      },
      'semanas': semanas,
      'productos': [
        for (final p in productos.take(10))
          {'productoId': p.key, 'nombre': p.value.nombre, 'unidades': p.value.unidades, 'ventas': p.value.ventas},
      ],
    };
  }

  // Promedio y cantidad por proveedor (resumenPorProveedor de
  // DrizzleCalificacionRepository), para el comparador del catálogo.
  ({double? promedio, int cantidad}) resumenCalificaciones(int proveedorId) {
    final envios = {
      for (final o in ordenes)
        for (final e in o.envios)
          if (e.proveedorId == proveedorId) e.id
    };
    final puntajes = calificaciones.where((c) => envios.contains(c.ordenEnvioId)).map((c) => c.puntaje).toList();
    if (puntajes.isEmpty) return (promedio: null, cantidad: 0);
    return (promedio: puntajes.reduce((a, b) => a + b) / puntajes.length, cantidad: puntajes.length);
  }

  // GET /calificaciones/recibidas (⏳, KAN-135).
  Map<String, dynamic> calificacionesRecibidas(int usuarioId) {
    final proveedorId = _proveedorDe(usuarioId);
    final items = [
      for (final c in calificaciones)
        for (final o in ordenes)
          for (final e in o.envios)
            if (e.id == c.ordenEnvioId && e.proveedorId == proveedorId) (c: c, o: o),
    ]..sort((a, b) => b.c.creadaEn.compareTo(a.c.creadaEn));
    final resumen = resumenCalificaciones(proveedorId);
    final pct = seedProveedores.where((p) => p.id == proveedorId).firstOrNull?.entregasATiempoPct;
    return {
      'resumen': {
        'promedio': resumen.promedio == null ? null : (resumen.promedio! * 100).round() / 100,
        'cantidad': resumen.cantidad,
        'distribucion': {for (var p = 1; p <= 5; p++) '$p': items.where((i) => i.c.puntaje == p).length},
      },
      'entregasATiempoPct': pct == null || pct == 0 ? null : pct,
      'items': [
        for (final i in items)
          {
            'id': i.c.id,
            'ordenEnvioId': i.c.ordenEnvioId,
            'ordenCodigo': i.o.codigo,
            'cliente': seedOrganizacion(i.o.organizacionId).nombre,
            'puntaje': i.c.puntaje,
            'comentario': i.c.comentario,
            'creadaEn': FakeBackend.iso(i.c.creadaEn),
          },
      ],
    };
  }

  // GET /alertas/proveedor (⏳, KAN-137).
  Map<String, dynamic> alertasProveedor(int usuarioId) {
    final proveedorId = _proveedorDe(usuarioId);
    final hoy = DateTime.parse('${FakeBackend.fecha(ahora())}T00:00:00Z');

    Map<String, dynamic> documento(String tipo, String? vence) {
      if (vence == null) return {'tipo': tipo, 'venceEn': null, 'estado': 'al_dia', 'diasParaVencer': null};
      final dias = DateTime.parse('${vence}T00:00:00Z').difference(hoy).inDays;
      final estado = dias < 0 ? 'vencido' : (dias <= diasAvisoVencimiento ? 'por_vencer' : 'al_dia');
      return {'tipo': tipo, 'venceEn': vence, 'estado': estado, 'diasParaVencer': dias};
    }

    // Próximo martes (CompraMejor liquida cada martes lo entregado la semana anterior).
    var martes = hoy.add(const Duration(days: 1));
    while (martes.weekday != DateTime.tuesday) {
      martes = martes.add(const Duration(days: 1));
    }

    final entregadoSinLiquidar = [
      for (final o in ordenes)
        for (final e in o.envios)
          if (e.proveedorId == proveedorId && e.estado == 'entregado' && e.liquidacionId == null) e.neto,
    ].fold(0, (s, n) => s + n);
    final pendientes = liquidaciones
        .where((l) => l.proveedorId == proveedorId && l.estado == 'pendiente')
        .fold(0, (s, l) => s + l.montoNeto);

    return {
      'documentos': [
        documento('carpeta_tributaria', null),
        documento('resolucion_sanitaria', seedVencimientoSanitaria[proveedorId]),
      ],
      'stockBajo': [
        for (final o in seedOfertas)
          if (o.proveedorId == proveedorId && o.estado == 'publicada' && stock[o.id]! <= umbralStockBajoCajas)
            {
              'ofertaId': o.id,
              'productoId': o.productoId,
              'producto': seedProductos.firstWhere((p) => p.id == o.productoId).nombre,
              'cajasDisponibles': stock[o.id],
              'cajasIniciales': o.cajasIniciales,
            },
      ],
      'porCobrar': {
        'entregadoSinLiquidar': entregadoSinLiquidar,
        'liquidacionesPendientes': pendientes,
        'total': entregadoSinLiquidar + pendientes,
        'proximaLiquidacion': FakeBackend.fecha(martes),
      },
      'enviosPorDespachar': [
        for (final o in ordenes)
          if (o.estado != 'pendiente_pago')
            for (final e in o.envios)
              if (e.proveedorId == proveedorId && e.estado == 'por_despachar') e.id,
      ].length,
    };
  }
}
