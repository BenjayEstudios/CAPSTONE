import 'categoria.dart';
import 'filtros_catalogo.dart';
import 'producto.dart';

// Origen de la visita a una ficha, para la analítica del proveedor
// (evento vista_producto, KAN-134).
enum OrigenVista { catalogo, busqueda, directo }

abstract interface class CatalogoRepository {
  Future<List<Categoria>> categorias();

  Future<PaginaProductos> buscarProductos(FiltrosCatalogo filtros, {int porPagina = 50});

  // Ofertas ordenadas por precio unitario ascendente.
  Future<ProductoDetalle> detalleProducto(int id, {OrigenVista origen = OrigenVista.directo});
}
