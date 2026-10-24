import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/features/catalogo/data/catalogo_fake_datasource.dart';
import 'package:cotizapp_mobile/features/catalogo/data/catalogo_repository_impl.dart';
import 'package:cotizapp_mobile/features/catalogo/domain/categoria.dart';
import 'package:cotizapp_mobile/features/catalogo/domain/filtros_catalogo.dart';
import 'package:cotizapp_mobile/features/catalogo/domain/producto.dart';
import 'package:flutter_test/flutter_test.dart';

// El fake implementa las reglas que API_CONTRACT.md le pide al backend; estos
// tests las fijan con los datos del seed.
void main() {
  const repo = CatalogoRepositoryImpl(CatalogoFakeDatasource(latencia: Duration.zero));

  Future<List<String>> nombres(FiltrosCatalogo f) async =>
      (await repo.buscarProductos(f)).items.map((p) => p.nombre).toList();

  test('categorías: 7 raíces y sus subcategorías', () async {
    final categorias = await repo.categorias();
    expect(categorias, hasLength(15));
    expect(categorias.raices.map((c) => c.nombre).first, 'Abarrotes');
    expect(categorias.hijasDe(1).map((c) => c.nombre), ['Aceites', 'Arroz y legumbres']);
    expect(categorias.raizDe(8)?.nombre, 'Abarrotes');
  });

  test('sin filtros trae los 17 productos con su rango de precios', () async {
    final pagina = await repo.buscarProductos(const FiltrosCatalogo());
    expect(pagina.total, 17);
    final aceite = pagina.items.firstWhere((p) => p.id == 1);
    expect(aceite.precioDesde, 12490);
    expect(aceite.precioHasta, 12890);
    expect(aceite.cantidadOfertas, 2);
    expect(aceite.precioDesdePorUnidad, 2498);
    expect(aceite.unidad, Unidad.litro);
  });

  test('la búsqueda ignora tildes y mayúsculas', () async {
    expect(await nombres(const FiltrosCatalogo(texto: 'AZUCAR')), ['Azúcar granulada']);
    expect(await nombres(const FiltrosCatalogo(texto: 'queso')), hasLength(2));
    expect(await nombres(const FiltrosCatalogo(texto: 'colún')), hasLength(2)); // también busca por marca
  });

  test('una categoría raíz incluye sus subcategorías', () async {
    expect(await nombres(const FiltrosCatalogo(categoriaId: 1)), hasLength(4));
    expect(await nombres(const FiltrosCatalogo(categoriaId: 8)), hasLength(2));
  });

  test('entrega 24 h deja fuera lo que solo vende Valle Central (48 h)', () async {
    final lista = await nombres(const FiltrosCatalogo(plazoMaxHoras: 24));
    expect(lista, hasLength(15));
    expect(lista, isNot(contains('Tomate larga vida')));
  });

  test('caja chica considera solo ofertas de hasta 6 unidades por caja', () async {
    final pagina = await repo.buscarProductos(const FiltrosCatalogo(cajaChica: true));
    // aceite y arroz (cajas de 4), harina y azúcar (1), quesos, huevos y bebida (6)
    expect(pagina.total, 8);
  });

  test('orden por mayor diferencia: primero la harina y sin productos de un solo proveedor', () async {
    final pagina = await repo.buscarProductos(const FiltrosCatalogo(orden: OrdenCatalogo.diferencia));
    expect(pagina.items.first.nombre, 'Harina sin polvos de hornear');
    expect(pagina.items.first.diferencia, 1500);
    expect(pagina.items.every((p) => p.cantidadOfertas >= 2), isTrue);
  });

  test('ficha: ofertas por precio y calificación promedio del proveedor', () async {
    final p = await repo.detalleProducto(1);
    expect(p.categoria.padreNombre, 'Abarrotes');
    expect(p.ofertas.map((o) => o.proveedor.nombre), ['Los Andes Food Service', 'Valle Central Mayorista']);
    final losAndes = p.ofertas.first.proveedor.calificacion;
    expect(losAndes.cantidad, 6);
    expect(losAndes.promedio, closeTo(4.67, 0.01));
  });

  test('ficha: no muestra ofertas en borrador, pausadas ni de proveedores en revisión', () async {
    expect((await repo.detalleProducto(14)).ofertas, hasLength(1)); // palta de Las Palmas en borrador
    expect((await repo.detalleProducto(16)).ofertas, hasLength(1)); // bebida de Valle Central pausada
  });

  test('producto inexistente es NotFoundFailure', () {
    expect(repo.detalleProducto(999), throwsA(isA<NotFoundFailure>()));
  });

  test('los filtros se traducen a los query params del contrato', () {
    const f = FiltrosCatalogo(
      texto: ' aceite ',
      categoriaId: 1,
      plazoMaxHoras: 24,
      cajaChica: true,
      orden: OrdenCatalogo.precio,
    );
    expect(f.aQuery(), {
      'q': 'aceite',
      'categoriaId': 1,
      'plazoMaxHoras': 24,
      'maxUnidadesPorCaja': 6,
      'orden': 'precio',
      'porPagina': 50,
    });
    expect(f.activos, 3);
    expect(const FiltrosCatalogo().aQuery(), {'porPagina': 50});
  });
}
