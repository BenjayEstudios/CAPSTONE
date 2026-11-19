import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/core/fake/fake_backend.dart';
import 'package:flutter_test/flutter_test.dart';

// Reglas de planificarOrden (packages/application/src/use-cases/carro.use-cases.ts)
// portadas a FakeBackend.
const elFogon = 8;
const dulceHogar = 9;

Matcher fallaCon(String code) => throwsA(isA<Failure>().having((f) => f.code, 'code', code));

void main() {
  late FakeBackend b;
  setUp(() => b = FakeBackend(ahora: () => DateTime.utc(2026, 11, 18, 15)));

  void carro(int usuario, List<(int ofertaId, int cantidad, int precioVisto)> items) => b.reemplazarCarro(usuario, {
        'items': [
          for (final (o, c, p) in items) {'ofertaId': o, 'cantidad': c, 'precioVisto': p},
        ],
      });

  test('el carro del seed de El Fogón no se puede pagar: pide 24 cajas de leche y hay 20', () {
    expect(() => b.confirmarCarro(elFogon, {'direccionId': 6}), fallaCon('SIN_STOCK'));
  });

  test('confirmar crea la orden pendiente de pago, un envío por proveedor, descuenta stock y vacía el carro', () {
    carro(dulceHogar, [(1, 2, 12490), (13, 3, 10490), (22, 1, 6590)]); // aceite y huevos Los Andes, queso FrigoSur
    final r = b.confirmarCarro(dulceHogar, {
      'direccionId': 7,
      'retiros': [
        {'proveedorId': 4, 'puntoRetiroId': 2},
      ],
      'requiereFactura': true,
    });

    expect(r['codigo'], 'CM-90012');
    expect(r['estado'], 'pendiente_pago');
    final envios = (r['envios'] as List).cast<Map<String, dynamic>>();
    expect(envios.map((e) => (e['proveedorId'], e['modalidad'])), [(2, 'despacho'), (4, 'retiro')]);
    // Los Andes: 2*12490 + 6590 = 31570 < 150000 -> despacho RM 4990. Retiro: 0.
    expect(envios.map((e) => e['costoDespacho']), [4990, 0]);
    expect(r['total'], 31570 + 4990 + 31470);
    expect(b.stock[1], 40 - 2);
    expect(b.obtenerCarro(dulceHogar)['items'], isEmpty);
  });

  test('precio distinto al visto: PRECIO_CAMBIO con las líneas en el detalle', () {
    carro(dulceHogar, [(1, 1, 11990)]);
    try {
      b.confirmarCarro(dulceHogar, {'direccionId': 7});
      fail('debía fallar');
    } on ValidationFailure catch (f) {
      expect(f.code, 'PRECIO_CAMBIO');
      expect((f.detalle as Map)['lineas'], [
        {'ofertaId': 1, 'precioVisto': 11990, 'precioActual': 12490},
      ]);
    }
  });

  test('sin dirección y con despacho: DIRECCION_REQUERIDA', () {
    carro(dulceHogar, [(1, 1, 12490)]);
    expect(() => b.confirmarCarro(dulceHogar, {}), fallaCon('DIRECCION_REQUERIDA'));
  });

  test('Valle Central no despacha a Concepción: SIN_COBERTURA', () {
    carro(dulceHogar, [(11, 1, 26990)]); // azúcar de Valle Central
    final concepcion = b.comunas().firstWhere((c) => c['nombre'] == 'Concepción')['id'];
    expect(
      () => b.confirmarCarro(dulceHogar, {
        'direccion': {'comunaId': concepcion, 'calle': "O'Higgins", 'numero': '100'},
      }),
      fallaCon('SIN_COBERTURA'),
    );
  });

  test('retiro en un proveedor que solo despacha: RETIRO_NO_DISPONIBLE', () {
    carro(dulceHogar, [(11, 1, 26990)]);
    expect(
      () => b.confirmarCarro(dulceHogar, {
        'retiros': [
          {'proveedorId': 3, 'puntoRetiroId': 1},
        ],
      }),
      fallaCon('RETIRO_NO_DISPONIBLE'),
    );
  });

  test('despacho gratis sobre el umbral del proveedor', () {
    carro(dulceHogar, [(1, 13, 12490)]); // 162370 >= 150000
    final r = b.confirmarCarro(dulceHogar, {'direccionId': 7});
    expect((r['envios'] as List).single['costoDespacho'], 0);
  });

  test('una dirección nueva queda guardada para la organización', () {
    carro(dulceHogar, [(1, 1, 12490)]);
    b.confirmarCarro(dulceHogar, {
      'direccion': {'comunaId': 23, 'calle': 'Av. Providencia', 'numero': '2000'},
    });
    final direcciones = b.opcionesEntrega(dulceHogar)['direcciones'] as List;
    expect(direcciones.map((d) => d['comuna']), ['Las Condes', 'Providencia']);
  });

  test('pago simulado: aprobado deja la orden pagada; rechazado queda pendiente con pago fallido', () {
    carro(dulceHogar, [(1, 1, 12490)]);
    final id = b.confirmarCarro(dulceHogar, {'direccionId': 7})['ordenId'] as int;
    expect(b.iniciarPago(dulceHogar, id, 'tarjeta')['urlPago'], 'fake://pasarela/$id');

    b.resolverPago(id, aprobado: false);
    expect(b.obtenerOrden(dulceHogar, id), containsPair('estadoPago', 'fallido'));
    expect(b.obtenerOrden(dulceHogar, id), containsPair('estado', 'pendiente_pago'));

    b.resolverPago(id, aprobado: true);
    final o = b.obtenerOrden(dulceHogar, id);
    expect((o['estado'], o['estadoPago'], o['medioPago']), ('pagada', 'pagado', 'tarjeta'));
    expect(() => b.iniciarPago(dulceHogar, id, 'tarjeta'), fallaCon('ORDEN_YA_PAGADA'));
  });
}
