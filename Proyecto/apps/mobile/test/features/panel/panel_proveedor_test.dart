import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/core/fake/fake_backend.dart';
import 'package:cotizapp_mobile/features/alertas/data/alertas_data.dart';
import 'package:cotizapp_mobile/features/alertas/domain/alertas.dart';
import 'package:cotizapp_mobile/features/alertas/presentation/alertas_providers.dart';
import 'package:cotizapp_mobile/features/calificaciones/data/calificaciones_data.dart';
import 'package:cotizapp_mobile/features/estadisticas/data/estadisticas_fake_datasource.dart';
import 'package:cotizapp_mobile/features/estadisticas/data/estadisticas_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

const losAndes = 4, valleCentral = 5, elFogon = 8;

// Valores calculados a mano sobre el seed (ver docs/cambios de KAN-133 a 137).
void main() {
  setUpAll(() => initializeDateFormatting('es_CL'));
  late FakeBackend b;
  setUp(() => b = FakeBackend(ahora: () => DateTime.utc(2026, 11, 18, 15)));

  group('ventas (KAN-133)', () {
    EstadisticasRepositoryImpl repo(int u) => EstadisticasRepositoryImpl(EstadisticasFakeDatasource(b, () => u));

    test('octubre de Los Andes: 3 envíos, ventas, despacho, comisión y neto', () async {
      final r = await repo(losAndes).ventas(desde: DateTime(2026, 10, 1), hasta: DateTime(2026, 10, 31));
      expect(r.totales.envios, 3);
      expect(r.totales.ventas, 84710 + 32950 + 100410);
      expect(r.totales.despacho, 4990 + 0 + 4990);
      expect(r.totales.comision, 6777 + 2636 + 8033);
      expect(r.totales.neto, 210604);
      expect(r.totales.ticketPromedio, (218070 / 3).round());
    });

    test('semanas de lunes a domingo con ceros donde no hubo ventas; top de productos', () async {
      final r = await repo(losAndes).ventas(desde: DateTime(2026, 8, 25), hasta: DateTime(2026, 11, 18));
      expect(r.semanas, hasLength(13));
      expect(r.semanas.first.semana, DateTime.utc(2026, 8, 24));
      expect(r.semanas.last.ventas, 0);
      expect(r.productos.first.nombre, 'Aceite vegetal maravilla');
      expect(r.productos.first.unidades, 12);
    });

    test('una orden pendiente de pago no cuenta como venta', () async {
      b.reemplazarCarro(9, {
        'items': [
          {'ofertaId': 1, 'cantidad': 1, 'precioVisto': 12490},
        ],
      });
      b.confirmarCarro(9, {'direccionId': 7});
      final r = await repo(losAndes).ventas(desde: DateTime(2026, 11, 1), hasta: DateTime(2026, 11, 18));
      expect(r.totales.envios, 0);
    });

    test('solo un proveedor tiene panel', () {
      expect(repo(elFogon).ventas(desde: DateTime(2026, 10, 1), hasta: DateTime(2026, 10, 31)),
          throwsA(isA<ForbiddenFailure>()));
    });
  });

  group('visitas (KAN-134)', () {
    test('totales, conversión, por producto y por comuna con la forma de GET /estadisticas/proveedor', () async {
      final v = await EstadisticasRepositoryImpl(EstadisticasFakeDatasource(b, () => losAndes))
          .visitas(desde: DateTime(2026, 8, 21), hasta: DateTime(2026, 11, 18));
      expect((v.vistas, v.clicks), (1094, 213));
      expect(v.conversion, closeTo(213 / 1094, 0.0001));
      expect(v.porDia, hasLength(90));
      expect(v.porProducto.first.producto, 'Aceite vegetal maravilla');
      expect(v.porComuna, isNotEmpty);
      // Los Andes despacha a toda la RM: todas las comunas del tráfico sintético son de la RM.
      expect(v.porComuna!.every((c) => c.cubre), isTrue);
    });

    test('los eventos que manda la app se suman', () async {
      final repo = EstadisticasRepositoryImpl(EstadisticasFakeDatasource(b, () => losAndes));
      final antes = await repo.visitas(desde: DateTime(2026, 11, 18), hasta: DateTime(2026, 11, 18));
      b.registrarEventos({
        'eventos': [
          {'tipo_evento': 'vista_producto', 'sesion_id': 'abcdef123456', 'producto_id': 1, 'origen': 'catalogo'},
          {'tipo_evento': 'click_oferta', 'sesion_id': 'abcdef123456', 'producto_id': 1, 'oferta_id': 1},
        ],
      });
      final despues = await repo.visitas(desde: DateTime(2026, 11, 18), hasta: DateTime(2026, 11, 18));
      expect((despues.vistas - antes.vistas, despues.clicks - antes.clicks), (1, 1));
    });
  });

  group('calificaciones recibidas (KAN-135)', () {
    test('promedio, distribución, % a tiempo y lista con orden asociada', () async {
      final c = await CalificacionesRepositoryImpl(CalificacionesFakeDatasource(b, () => losAndes)).recibidas();
      expect(c.cantidad, 6);
      expect(c.promedio, closeTo(4.67, 0.01));
      expect(c.distribucion, {1: 0, 2: 0, 3: 0, 4: 2, 5: 4});
      expect(c.entregasATiempoPct, 96.5);
      expect(c.items.first.ordenCodigo, 'CM-10009'); // la más reciente primero
      expect(c.items.map((i) => i.cliente).toSet(), {'El Fogón', 'Dulce Hogar'});
    });
  });

  group('alertas (KAN-137)', () {
    test('Los Andes: stock bajo, documentos al día y por cobrar del último corte', () async {
      final a = await AlertasRepositoryImpl(AlertasFakeDatasource(b, () => losAndes)).obtener();
      expect(a.stockBajo.map((s) => (s.producto, s.cajasDisponibles)),
          [('Leche entera', 20), ('Posta negra de vacuno', 20)]);
      expect(a.documentos.every((d) => d.estado == EstadoDocumento.alDia), isTrue);
      expect(a.porCobrar.liquidacionesPendientes, 97367);
      expect(a.porCobrar.proximaLiquidacion, DateTime(2026, 11, 24));
      expect(alertasDe(a).map((x) => x.severidad), [Severidad.advertencia, Severidad.advertencia]);
    });

    test('Valle Central: resolución sanitaria vencida (15 nov) y envío por despachar', () async {
      final a = await AlertasRepositoryImpl(AlertasFakeDatasource(b, () => valleCentral)).obtener();
      final sanitaria = a.documentos.firstWhere((d) => d.tipo == 'resolucion_sanitaria');
      expect(sanitaria.estado, EstadoDocumento.vencido);
      expect(a.enviosPorDespachar, 1); // CM-10011
      final alertas = alertasDe(a);
      expect(alertas.first.severidad, Severidad.critica);
      expect(alertas.last.irAOrdenes, isTrue);
    });

    test('lo entregado en la demo queda por cobrar hasta el próximo corte', () async {
      final repo = AlertasRepositoryImpl(AlertasFakeDatasource(b, () => valleCentral));
      final antes = (await repo.obtener()).porCobrar.entregadoSinLiquidar;
      final envio = (b.obtenerOrden(valleCentral, 11)['envios'] as List).single['id'] as int;
      for (final e in ['en_preparacion', 'despachado', 'entregado']) {
        b.cambiarEstadoEnvio(valleCentral, envio, {'estado': e});
      }
      final despues = (await repo.obtener()).porCobrar.entregadoSinLiquidar;
      // CM-10011: 28920 + 5990 de despacho - 7,5% de comisión
      expect(despues - antes, 28920 + 5990 - (28920 * 7.5 / 100).round());
    });
  });
}
