import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/core/fake/fake_backend.dart';
import 'package:cotizapp_mobile/features/carro/data/carro_fake_datasource.dart';
import 'package:cotizapp_mobile/features/carro/data/carro_repository_impl.dart';
import 'package:cotizapp_mobile/features/carro/domain/carro.dart';
import 'package:cotizapp_mobile/features/catalogo/data/catalogo_fake_datasource.dart';
import 'package:cotizapp_mobile/features/catalogo/data/catalogo_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';

const elFogon = 8;
const dulceHogar = 9;
const losAndes = 4;

void main() {
  late FakeBackend backend;
  CarroRepositoryImpl repo(int usuario) => CarroRepositoryImpl(
        CarroFakeDatasource(backend, () => usuario),
        const CatalogoRepositoryImpl(CatalogoFakeDatasource(latencia: Duration.zero)),
      );

  setUp(() => backend = FakeBackend());

  test('el carro del seed de El Fogón se agrupa por proveedor con subtotales, despacho y ahorro', () async {
    final carro = await repo(elFogon).obtener();

    expect(carro.grupos.map((g) => g.nombre), ['Los Andes Food Service', 'FrigoSur', 'Valle Central Mayorista']);
    expect(carro.grupos.map((g) => g.subtotal), [26160, 31470, 13900]);
    expect(carro.grupos.map((g) => g.plazoHoras), [24, 24, 48]);
    expect(carro.subtotal, 71530);
    expect(carro.despachos, 4990 + 6990 + 5990);
    expect(carro.total, 89500);
    // leche: (1150-1090)*24; queso: (11290-10490)*3; el tomate solo lo vende Valle Central.
    expect(carro.ahorro, 1440 + 2400);
  });

  test('el despacho es gratis al llegar al umbral del proveedor', () async {
    final r = repo(elFogon);
    final carro = await r.obtener();
    final leche = carro.items.first;
    // 140 cajas de leche de Los Andes = $152.600 >= $150.000
    final nuevo = await r.guardar([
      ItemCarro(ofertaId: leche.ofertaId, cantidad: 140, precioVisto: leche.precioVisto),
      ...carro.items.skip(1),
    ]);
    expect(nuevo.grupos.first.despachoEstimado, 0);
    expect(nuevo.grupos.first.faltaParaGratis, isNull);
  });

  test('un comprador nuevo parte con el carro vacío', () async {
    expect((await repo(dulceHogar).obtener()).estaVacio, isTrue);
  });

  test('el distribuidor no tiene carro (403 como en la API)', () {
    expect(repo(losAndes).obtener(), throwsA(isA<ForbiddenFailure>()));
  });

  test('PUT /carro rechaza ofertas no publicadas y repetidas', () async {
    final r = repo(dulceHogar);
    // 33 = bebida cola de Valle Central (pausada)
    await expectLater(
      r.guardar([const ItemCarro(ofertaId: 33, cantidad: 1, precioVisto: 3190)]),
      throwsA(isA<ValidationFailure>().having((f) => f.code, 'code', 'OFERTA_NO_DISPONIBLE')),
    );
    await expectLater(
      r.guardar(const [
        ItemCarro(ofertaId: 1, cantidad: 1, precioVisto: 12490),
        ItemCarro(ofertaId: 1, cantidad: 2, precioVisto: 12490)
      ]),
      throwsA(isA<ValidationFailure>().having((f) => f.code, 'code', 'ITEM_DUPLICADO')),
    );
  });

  test('detecta precios cambiados y stock disponible por línea', () async {
    final r = repo(dulceHogar);
    final carro = await r.guardar(const [ItemCarro(ofertaId: 1, cantidad: 2, precioVisto: 11990)]);
    final linea = carro.lineas.single;
    expect(linea.item.precioCambio, isTrue);
    expect(carro.hayPreciosCambiados, isTrue);
    expect(linea.cantidadMinima, 1);
    expect(linea.cantidadMaxima, 40);
  });
}
