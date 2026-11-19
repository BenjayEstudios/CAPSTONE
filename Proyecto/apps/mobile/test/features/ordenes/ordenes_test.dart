import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/core/fake/fake_backend.dart';
import 'package:cotizapp_mobile/features/ordenes/data/ordenes_fake_datasource.dart';
import 'package:cotizapp_mobile/features/ordenes/data/ordenes_repository_impl.dart';
import 'package:cotizapp_mobile/features/ordenes/domain/orden.dart';
import 'package:flutter_test/flutter_test.dart';

const elFogon = 8, dulceHogar = 9, losAndes = 4, valleCentral = 5;

void main() {
  late FakeBackend backend;
  OrdenesRepositoryImpl repo(int usuario) => OrdenesRepositoryImpl(OrdenesFakeDatasource(backend, () => usuario));

  setUp(() => backend = FakeBackend(ahora: () => DateTime.utc(2026, 11, 18, 15)));

  test('el cliente ve sus órdenes, de la más nueva a la más antigua, sin comisiones', () async {
    final pagina = await repo(elFogon).listar();
    expect(pagina.items.map((o) => o.codigo), ['CM-10011', 'CM-10009', 'CM-10007', 'CM-10005', 'CM-10003', 'CM-10001']);
    final o = pagina.items.first;
    // arroz 2 x 6990 + lentejas 6 x 2490 + despacho Valle Central RM
    expect((o.subtotal, o.costoDespachoTotal, o.total), (28920, 5990, 34910));
    expect(o.montoALiquidarTotal, isNull);
    expect(o.clienteOrganizacion, isNull);
  });

  test('el detalle trae líneas, dirección, punto de retiro y calificación', () async {
    final o = await repo(elFogon).obtener(5); // CM-10005: FrigoSur despacho + Los Andes retiro
    expect(o.direccion?.comuna, 'Ñuñoa');
    final retiro = o.envios.firstWhere((e) => e.esRetiro);
    expect(retiro.puntoRetiro?.nombre, 'Bodega Quilicura');
    expect(retiro.costoDespacho, 0);
    expect(retiro.calificacion?.puntaje, 4);
    expect(retiro.lineas.map((l) => l.nombreProducto), ['Aceite vegetal maravilla', 'Guantes de nitrilo talla M']);
  });

  test('el proveedor solo ve su envío y sus montos', () async {
    final pagina = await repo(losAndes).listar();
    expect(
        pagina.items.every((o) => o.envios.length == 1 && o.envios.single.proveedorNombre == 'Los Andes Food Service'),
        isTrue);
    final o2 = pagina.items.firstWhere((o) => o.codigo == 'CM-10002');
    expect(o2.clienteOrganizacion, 'Dulce Hogar');
    expect(o2.total, 5 * 6590); // solo su tramo (retiro, sin despacho)
    expect(o2.montoALiquidarTotal, 5 * 6590 - (5 * 6590 * 8 / 100).round());
  });

  test('un cliente no puede ver la orden de otro', () {
    expect(repo(dulceHogar).obtener(1), throwsA(isA<NotFoundFailure>()));
  });

  test('calificar un envío entregado; no dos veces; no uno sin entregar', () async {
    final r = repo(dulceHogar);
    final o10 = await r.obtener(10); // CM-10010: entregada, sin calificar
    final envio = o10.envios.first;
    expect(envio.calificable, isTrue);

    await r.calificarEnvio(envio.id, puntaje: 4, comentario: '  Todo bien  ');
    final despues = await r.obtener(10);
    expect(despues.envios.first.calificacion?.puntaje, 4);
    expect(despues.envios.first.calificacion?.comentario, 'Todo bien');

    await expectLater(
      r.calificarEnvio(envio.id, puntaje: 5),
      throwsA(isA<ValidationFailure>().having((f) => f.code, 'code', 'YA_CALIFICADO')),
    );
    final o2 = await r.obtener(2); // en preparación
    await expectLater(
      r.calificarEnvio(o2.envios.first.id, puntaje: 5),
      throwsA(isA<ValidationFailure>().having((f) => f.code, 'code', 'ENVIO_NO_CALIFICABLE')),
    );
  });

  test('la máquina de estados del envío sigue a transicionesPermitidas', () {
    expect(EstadoEnvio.porDespachar.siguiente(esRetiro: false), EstadoEnvio.enPreparacion);
    expect(EstadoEnvio.enPreparacion.siguiente(esRetiro: false), EstadoEnvio.despachado);
    expect(EstadoEnvio.enPreparacion.siguiente(esRetiro: true), EstadoEnvio.listoRetiro);
    expect(EstadoEnvio.listoRetiro.siguiente(esRetiro: true), EstadoEnvio.entregado);
    expect(EstadoEnvio.entregado.siguiente(esRetiro: true), isNull);
  });

  test('avanzar un envío recalcula el estado de la orden; saltos inválidos dan TRANSICION_INVALIDA', () async {
    final r = repo(valleCentral);
    final o11 = await r.obtener(11); // pagada, envío por despachar
    final id = o11.envios.single.id;
    await expectLater(
      r.cambiarEstadoEnvio(id, EstadoEnvio.entregado),
      throwsA(isA<ValidationFailure>().having((f) => f.code, 'code', 'TRANSICION_INVALIDA')),
    );
    expect((await r.cambiarEstadoEnvio(id, EstadoEnvio.enPreparacion)).orden, EstadoOrden.enPreparacion);
    expect((await r.cambiarEstadoEnvio(id, EstadoEnvio.despachado)).orden, EstadoOrden.despachada);
    expect((await r.cambiarEstadoEnvio(id, EstadoEnvio.entregado)).orden, EstadoOrden.entregada);
  });

  test('un proveedor no puede tocar el envío de otro', () async {
    final envioValle = (await repo(valleCentral).obtener(11)).envios.single.id;
    expect(repo(losAndes).cambiarEstadoEnvio(envioValle, EstadoEnvio.enPreparacion), throwsA(isA<NotFoundFailure>()));
  });
}
