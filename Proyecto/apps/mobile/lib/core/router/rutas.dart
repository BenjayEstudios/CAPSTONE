import '../../features/auth/domain/perfil.dart';
import '../../features/ordenes/domain/orden.dart';

// Paths de go_router en un solo lugar, para no repetir strings sueltos en
// cada context.go(). Cada perfil vive bajo su propio prefijo, así el
// redirect puede impedir que un comprador entre a /proveedor/* y viceversa.
abstract final class Rutas {
  static const splash = '/';
  static const login = '/login';
  static const conexion = '/conexion';

  static const comprador = '/comprador';
  static const compradorCatalogo = '/comprador/catalogo';
  static const compradorCarro = '/comprador/carro';
  static const checkout = '/comprador/carro/checkout';
  static const compradorPedidos = '/comprador/pedidos';
  static const compradorCuenta = '/comprador/cuenta';

  static const proveedor = '/proveedor';
  static const proveedorOrdenes = '/proveedor/ordenes';
  static const proveedorCalificaciones = '/proveedor/calificaciones';
  static const proveedorAlertas = '/proveedor/alertas';
  static const proveedorCuenta = '/proveedor/cuenta';

  // Listado / búsqueda del catálogo (KAN-127/128). buscar=true abre con el
  // teclado en el campo de búsqueda.
  static String catalogo({int? categoriaId, String? texto, bool buscar = false}) => Uri(
        path: compradorCatalogo,
        queryParameters: {
          if (categoriaId != null) 'categoriaId': '$categoriaId',
          if (texto != null && texto.isNotEmpty) 'q': texto,
          if (buscar) 'buscar': '1',
        },
      ).toString().replaceAll(RegExp(r'\?$'), '');

  // Ficha con comparador (KAN-129). origen alimenta la analítica del
  // proveedor (catalogo | busqueda | directo).
  static String producto(int id, {String origen = 'directo'}) => '/comprador/producto/$id?origen=$origen';

  // Detalle de un pedido del comprador (KAN-132).
  static String pedido(int id) => '$compradorPedidos/$id';

  // Pasarela simulada del fake (KAN-131): pantalla completa, fuera del shell.
  static String pasarela(int ordenId, {required MedioPago medio}) =>
      '/comprador/pasarela/$ordenId?medio=${medio.codigo}';

  // Resultado del pago: confirmación con el folio o reintento.
  static String resultadoPago(int ordenId, {String? error}) => Uri(
        path: '$compradorPedidos/$ordenId/pago',
        queryParameters: {if (error != null) 'error': error},
      ).toString().replaceAll(RegExp(r'\?$'), '');

  // Detalle de una orden del distribuidor (KAN-136).
  static String ordenProveedor(int id) => '$proveedorOrdenes/$id';

  static String inicioDe(Perfil perfil) => switch (perfil) {
        Perfil.comprador => comprador,
        Perfil.proveedor => proveedor,
      };
}
